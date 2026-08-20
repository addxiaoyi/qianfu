use std::{collections::BTreeMap, net::IpAddr};

use async_trait::async_trait;
use base64::{Engine, engine::general_purpose::STANDARD};
use hmac::{Hmac, Mac};
use qianfu_core::SecretString;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use thiserror::Error;
use url::form_urlencoded::byte_serialize;
use uuid::Uuid;

mod mail;
mod probe;

pub use mail::{
    MailAccount, MailAccountRegistry, MailError, MailMessage, MailProtocol, Pop3Settings,
    SmtpSettings, parse_pop3_list,
};
pub use probe::{ProbeError, ProbeResult, probe_server};

fn provider_http_client() -> Client {
    Client::builder()
        .connect_timeout(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("provider HTTP client configuration is valid")
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
pub enum DnsRecordType {
    A,
    Aaaa,
    Cname,
    Srv,
}

impl DnsRecordType {
    fn as_str(self) -> &'static str {
        match self {
            Self::A => "A",
            Self::Aaaa => "AAAA",
            Self::Cname => "CNAME",
            Self::Srv => "SRV",
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize)]
pub struct DnsRecord {
    pub record_type: DnsRecordType,
    pub name: String,
    pub content: String,
    pub ttl: u32,
}

#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("DNS provider request failed")]
    Http(#[from] reqwest::Error),
    #[error("DNS provider returned an invalid response")]
    InvalidResponse,
    #[error("DNS target is invalid")]
    InvalidTarget,
    #[error("DNS provider rejected the request")]
    Rejected,
    #[error("media content is invalid")]
    InvalidMedia,
    #[error("media object key is invalid")]
    InvalidObjectKey,
}

pub const MAX_MEDIA_BYTES: usize = 5 * 1024 * 1024;

#[derive(Clone)]
pub struct R2MediaClient {
    http: Client,
    endpoint: url::Url,
    bucket: String,
    public_url: url::Url,
    access_key_id: SecretString,
    secret_access_key: SecretString,
}

impl std::fmt::Debug for R2MediaClient {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("R2MediaClient")
            .field("endpoint", &self.endpoint)
            .field("bucket", &self.bucket)
            .field("public_url", &self.public_url)
            .field("access_key_id", &self.access_key_id)
            .finish()
    }
}

impl R2MediaClient {
    pub fn new(
        endpoint: impl AsRef<str>,
        bucket: impl Into<String>,
        public_url: impl AsRef<str>,
        access_key_id: SecretString,
        secret_access_key: SecretString,
    ) -> Result<Self, ProviderError> {
        let endpoint =
            url::Url::parse(endpoint.as_ref()).map_err(|_| ProviderError::InvalidTarget)?;
        let public_url =
            url::Url::parse(public_url.as_ref()).map_err(|_| ProviderError::InvalidTarget)?;
        if endpoint.scheme() != "https" || public_url.scheme() != "https" {
            return Err(ProviderError::InvalidTarget);
        }
        let bucket = bucket.into();
        if bucket.is_empty() || bucket.contains('/') || bucket.contains(' ') {
            return Err(ProviderError::InvalidTarget);
        }
        Ok(Self {
            http: provider_http_client(),
            endpoint,
            bucket,
            public_url,
            access_key_id,
            secret_access_key,
        })
    }

    pub async fn put(
        &self,
        object_key: &str,
        content_type: &str,
        bytes: Vec<u8>,
    ) -> Result<String, ProviderError> {
        validate_media(content_type, object_key, &bytes)?;
        let payload_hash = hex_sha256(&bytes);
        let now = chrono::Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let short_date = now.format("%Y%m%d").to_string();
        let path = format!("/{}/{}", self.bucket, object_key);
        let host = self
            .endpoint
            .host_str()
            .ok_or(ProviderError::InvalidTarget)?;
        let canonical_headers =
            format!("host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n");
        let signed_headers = "host;x-amz-content-sha256;x-amz-date";
        let canonical_request =
            format!("PUT\n{path}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}");
        let scope = format!("{short_date}/auto/s3/aws4_request");
        let credential = format!("{}/{scope}", self.access_key_id.as_str());
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
            hex_sha256(canonical_request.as_bytes())
        );
        let signing_key = signing_key(self.secret_access_key.as_str(), &short_date);
        let signature = hex_hmac(&signing_key, string_to_sign.as_bytes());
        let authorization = format!(
            "AWS4-HMAC-SHA256 Credential={credential}, SignedHeaders={signed_headers}, Signature={signature}"
        );
        let mut upload_url = self.endpoint.clone();
        upload_url.set_path(&path);
        let response = self
            .http
            .put(upload_url)
            .header("content-type", content_type)
            .header("x-amz-content-sha256", payload_hash)
            .header("x-amz-date", amz_date)
            .header("authorization", authorization)
            .body(bytes)
            .send()
            .await?;
        if !response.status().is_success() {
            return Err(ProviderError::Rejected);
        }
        let mut public = self.public_url.clone();
        public
            .path_segments_mut()
            .map_err(|_| ProviderError::InvalidTarget)?
            .pop_if_empty()
            .extend(object_key.split('/'));
        Ok(public.to_string())
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
fn hex_decode(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            u8::from_str_radix(std::str::from_utf8(pair).expect("hex is ASCII"), 16)
                .expect("hex output")
        })
        .collect()
}
fn hex_sha256(bytes: &[u8]) -> String {
    hex_encode(&Sha256::digest(bytes))
}
fn hex_hmac(key: &[u8], value: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts keys");
    mac.update(value);
    hex_encode(&mac.finalize().into_bytes())
}
fn signing_key(secret: &str, date: &str) -> Vec<u8> {
    let k = hex_hmac(format!("AWS4{secret}").as_bytes(), date.as_bytes());
    let k = hex_decode(&k);
    let k = hex_hmac(&k, b"auto");
    let k = hex_decode(&k);
    let k = hex_hmac(&k, b"s3");
    let k = hex_decode(&k);
    let k = hex_hmac(&k, b"aws4_request");
    hex_decode(&k)
}

pub fn validate_object_key(object_key: &str) -> Result<(), ProviderError> {
    if object_key.is_empty()
        || object_key.len() > 180
        || object_key.starts_with('/')
        || object_key.contains("..")
        || !object_key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"/_-.".contains(&byte))
    {
        return Err(ProviderError::InvalidObjectKey);
    }
    Ok(())
}

pub fn validate_media(
    content_type: &str,
    object_key: &str,
    bytes: &[u8],
) -> Result<(), ProviderError> {
    if bytes.is_empty() || bytes.len() > MAX_MEDIA_BYTES {
        return Err(ProviderError::InvalidMedia);
    }
    validate_object_key(object_key)?;
    let header_matches = match content_type {
        "image/png" => bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/jpeg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "image/gif" => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        "image/webp" => bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP",
        _ => false,
    };
    if header_matches {
        Ok(())
    } else {
        Err(ProviderError::InvalidMedia)
    }
}

#[async_trait]
pub trait DnsProvider: Send + Sync {
    async fn ensure_record(&self, record: &DnsRecord) -> Result<String, ProviderError>;
    async fn delete_record(&self, record_id: &str) -> Result<(), ProviderError>;
}

pub fn build_dns_records(
    domain: &str,
    target: &str,
    port: u16,
    ttl: u32,
) -> Result<Vec<DnsRecord>, ProviderError> {
    let domain = normalize_domain(domain)?;
    let target = target.trim().trim_end_matches('.').to_owned();
    if target.is_empty() || target.chars().any(char::is_whitespace) {
        return Err(ProviderError::InvalidTarget);
    }
    let record_type = match target.parse::<IpAddr>() {
        Ok(IpAddr::V4(_)) => DnsRecordType::A,
        Ok(IpAddr::V6(_)) => DnsRecordType::Aaaa,
        Err(_) if is_hostname(&target) => DnsRecordType::Cname,
        Err(_) => return Err(ProviderError::InvalidTarget),
    };
    let mut records = vec![DnsRecord {
        record_type,
        name: domain.clone(),
        content: target,
        ttl,
    }];
    if port != 25_565 {
        records.push(DnsRecord {
            record_type: DnsRecordType::Srv,
            name: format!("_minecraft._tcp.{domain}"),
            content: format!("0 0 {port} {domain}"),
            ttl,
        });
    }
    Ok(records)
}

fn normalize_domain(value: &str) -> Result<String, ProviderError> {
    let domain = value.trim().trim_end_matches('.').to_ascii_lowercase();
    if domain.is_empty() || domain.len() > 253 || !is_hostname(&domain) {
        return Err(ProviderError::InvalidTarget);
    }
    Ok(domain)
}

fn is_hostname(value: &str) -> bool {
    value.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    })
}

pub fn aliyun_signature(secret: &str, method: &str, canonical_query: &str) -> String {
    let encoded_query = percent_encode(canonical_query);
    let string_to_sign = format!("{}&%2F&{}", method.to_ascii_uppercase(), encoded_query);
    let mut mac = Hmac::<Sha1>::new_from_slice(format!("{secret}&").as_bytes())
        .expect("HMAC accepts keys of every length");
    mac.update(string_to_sign.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

fn percent_encode(value: &str) -> String {
    byte_serialize(value.as_bytes()).collect()
}

#[derive(Clone)]
pub struct CloudflareDnsClient {
    http: Client,
    token: SecretString,
    zone_id: String,
}

impl std::fmt::Debug for CloudflareDnsClient {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("CloudflareDnsClient")
            .field("token", &self.token)
            .field("zone_id", &self.zone_id)
            .finish()
    }
}

impl CloudflareDnsClient {
    pub fn new(token: SecretString, zone_id: impl Into<String>) -> Self {
        Self {
            http: provider_http_client(),
            token,
            zone_id: zone_id.into(),
        }
    }

    fn endpoint(&self, suffix: &str) -> String {
        format!(
            "https://api.cloudflare.com/client/v4/zones/{}/dns_records{suffix}",
            self.zone_id
        )
    }
}

#[derive(Debug, Deserialize)]
struct CloudflareEnvelope<T> {
    success: bool,
    result: T,
}

#[derive(Debug, Deserialize)]
struct CloudflareRecord {
    id: String,
    #[serde(rename = "type")]
    record_type: String,
    name: String,
    content: String,
}

#[async_trait]
impl DnsProvider for CloudflareDnsClient {
    async fn ensure_record(&self, record: &DnsRecord) -> Result<String, ProviderError> {
        let query = [
            ("type", record.record_type.as_str()),
            ("name", record.name.as_str()),
            ("content", record.content.as_str()),
        ];
        let response = self
            .http
            .get(self.endpoint(""))
            .bearer_auth(self.token.as_str())
            .query(&query)
            .send()
            .await?;
        if !response.status().is_success() {
            return Err(ProviderError::Rejected);
        }
        let body = response
            .json::<CloudflareEnvelope<Vec<CloudflareRecord>>>()
            .await?;
        if !body.success {
            return Err(ProviderError::Rejected);
        }
        if let Some(existing) = body.result.into_iter().find(|item| {
            item.record_type == record.record_type.as_str()
                && item.name.eq_ignore_ascii_case(&record.name)
                && item
                    .content
                    .trim_end_matches('.')
                    .eq_ignore_ascii_case(record.content.trim_end_matches('.'))
        }) {
            return Ok(existing.id);
        }
        let response = self
            .http
            .post(self.endpoint(""))
            .bearer_auth(self.token.as_str())
            .json(&serde_json::json!({
                "type": record.record_type.as_str(),
                "name": record.name,
                "content": record.content,
                "ttl": record.ttl,
                "proxied": false,
            }))
            .send()
            .await?;
        if !response.status().is_success() {
            return Err(ProviderError::Rejected);
        }
        let body = response
            .json::<CloudflareEnvelope<CloudflareRecord>>()
            .await?;
        if body.success {
            Ok(body.result.id)
        } else {
            Err(ProviderError::Rejected)
        }
    }

    async fn delete_record(&self, record_id: &str) -> Result<(), ProviderError> {
        let response = self
            .http
            .delete(self.endpoint(&format!("/{}", record_id)))
            .bearer_auth(self.token.as_str())
            .send()
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(());
        }
        if response.status().is_success() {
            Ok(())
        } else {
            Err(ProviderError::Rejected)
        }
    }
}

#[derive(Clone)]
pub struct AliyunDnsClient {
    http: Client,
    access_key_id: SecretString,
    access_key_secret: SecretString,
    endpoint: String,
    zone: String,
}

impl std::fmt::Debug for AliyunDnsClient {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AliyunDnsClient")
            .field("access_key_id", &self.access_key_id)
            .field("access_key_secret", &self.access_key_secret)
            .field("endpoint", &self.endpoint)
            .finish()
    }
}

impl AliyunDnsClient {
    pub fn new(
        access_key_id: SecretString,
        access_key_secret: SecretString,
        endpoint: impl Into<String>,
        zone: impl Into<String>,
    ) -> Self {
        Self {
            http: provider_http_client(),
            access_key_id,
            access_key_secret,
            endpoint: endpoint.into(),
            zone: zone.into(),
        }
    }

    async fn rpc(
        &self,
        action: &str,
        mut params: BTreeMap<String, String>,
    ) -> Result<serde_json::Value, ProviderError> {
        params.insert(
            "AccessKeyId".to_owned(),
            self.access_key_id.as_str().to_owned(),
        );
        params.insert("Action".to_owned(), action.to_owned());
        params.insert("Format".to_owned(), "JSON".to_owned());
        params.insert("SignatureMethod".to_owned(), "HMAC-SHA1".to_owned());
        params.insert("SignatureNonce".to_owned(), Uuid::new_v4().to_string());
        params.insert("SignatureVersion".to_owned(), "1.0".to_owned());
        params.insert(
            "Timestamp".to_owned(),
            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        );
        params.insert("Version".to_owned(), "2015-01-09".to_owned());
        let canonical = params
            .iter()
            .map(|(key, value)| format!("{}={}", percent_encode(key), percent_encode(value)))
            .collect::<Vec<_>>()
            .join("&");
        let signature = aliyun_signature(self.access_key_secret.as_str(), "GET", &canonical);
        params.insert("Signature".to_owned(), signature);
        let response = self.http.get(&self.endpoint).query(&params).send().await?;
        if !response.status().is_success() {
            return Err(ProviderError::Rejected);
        }
        let body = response.json::<serde_json::Value>().await?;
        if body.get("Code").is_some() {
            Err(ProviderError::Rejected)
        } else {
            Ok(body)
        }
    }
}

#[async_trait]
impl DnsProvider for AliyunDnsClient {
    async fn ensure_record(&self, record: &DnsRecord) -> Result<String, ProviderError> {
        let (rr, domain) = split_record_name(&record.name, &self.zone);
        let mut lookup = BTreeMap::new();
        lookup.insert("DomainName".to_owned(), domain.clone());
        lookup.insert("RRKeyWord".to_owned(), rr.clone());
        lookup.insert(
            "TypeKeyWord".to_owned(),
            record.record_type.as_str().to_owned(),
        );
        let existing = self.rpc("DescribeDomainRecords", lookup).await?;
        if let Some(record_id) = existing
            .get("DomainRecords")
            .and_then(|records| records.get("Record"))
            .and_then(serde_json::Value::as_array)
            .and_then(|records| {
                records.iter().find_map(|item| {
                    let same_rr = item
                        .get("RR")
                        .and_then(serde_json::Value::as_str)
                        .is_some_and(|value| value.eq_ignore_ascii_case(&rr));
                    let same_type = item
                        .get("Type")
                        .and_then(serde_json::Value::as_str)
                        .is_some_and(|value| {
                            value.eq_ignore_ascii_case(record.record_type.as_str())
                        });
                    let same_content = item
                        .get("Value")
                        .and_then(serde_json::Value::as_str)
                        .is_some_and(|value| {
                            value
                                .trim_end_matches('.')
                                .eq_ignore_ascii_case(record.content.trim_end_matches('.'))
                        });
                    (same_rr && same_type && same_content)
                        .then(|| item.get("RecordId").and_then(serde_json::Value::as_str))
                        .flatten()
                })
            })
        {
            return Ok(record_id.to_owned());
        }
        let mut query = BTreeMap::new();
        query.insert("DomainName".to_owned(), domain);
        query.insert("RR".to_owned(), rr);
        query.insert("Type".to_owned(), record.record_type.as_str().to_owned());
        query.insert("Value".to_owned(), record.content.clone());
        query.insert("TTL".to_owned(), record.ttl.to_string());
        let body = self.rpc("AddDomainRecord", query).await?;
        body.get("RecordId")
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned)
            .ok_or(ProviderError::InvalidResponse)
    }

    async fn delete_record(&self, record_id: &str) -> Result<(), ProviderError> {
        let mut query = BTreeMap::new();
        query.insert("RecordId".to_owned(), record_id.to_owned());
        self.rpc("DeleteDomainRecord", query).await.map(|_| ())
    }
}

pub fn split_record_name(name: &str, zone: &str) -> (String, String) {
    let normalized_name = name.trim_end_matches('.').to_ascii_lowercase();
    let normalized_zone = zone.trim().trim_end_matches('.').to_ascii_lowercase();
    let suffix = format!(".{normalized_zone}");
    if normalized_name == normalized_zone {
        return ("@".to_owned(), normalized_zone);
    }
    if let Some(rr) = normalized_name.strip_suffix(&suffix) {
        return (rr.to_owned(), normalized_zone);
    }
    (normalized_name, normalized_zone)
}
