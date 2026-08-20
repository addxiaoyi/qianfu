use std::{future::Future, net::IpAddr, pin::Pin};

use chrono::{DateTime, Duration, Utc};
use qianfu_core::{
    AppConfig, DnsTaskPayload, RetryPolicy, TaskError, TaskKind, TaskPayload, TaskRecord,
};
use qianfu_providers::{
    AliyunDnsClient, CloudflareDnsClient, DnsProvider, MailAccount, MailMessage, ProviderError,
    R2MediaClient, SmtpSettings, build_dns_records, probe_server, validate_media,
};
use qianfu_storage::{DnsRecordInsert, PgStorage, TaskRecord as StoredTask};

pub type TaskFuture<'a> = Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>>;

pub trait TaskHandler: Send + Sync {
    fn kind(&self) -> TaskKind;
    fn execute<'a>(&'a self, task: &'a TaskRecord) -> TaskFuture<'a>;
}

pub async fn execute_once<H: TaskHandler>(
    task: &mut TaskRecord,
    handler: &H,
    _retry_policy: &RetryPolicy,
) -> Result<(), TaskError> {
    if task.kind != handler.kind() {
        return Err(TaskError::UnsupportedHandler);
    }

    task.claim()?;
    match handler.execute(task).await {
        Ok(()) => task.succeed(),
        Err(message) => task.fail(message),
    }
}

pub fn retry_at(now: DateTime<Utc>, attempt: i32) -> DateTime<Utc> {
    let policy = RetryPolicy::new(5, 2, 30);
    now + Duration::seconds(policy.delay_seconds(attempt.max(1) as u32) as i64)
}

pub async fn process_task(
    storage: &PgStorage,
    task: &StoredTask,
    config: &AppConfig,
) -> Result<(), String> {
    let payload: TaskPayload = serde_json::from_value(task.payload.clone())
        .map_err(|error| format!("task payload is invalid: {error}"))?;

    let execution = match payload {
        TaskPayload::DnsApply(mut payload) => {
            let provider = dns_provider(&payload, config)?;
            let record_ids = execute_dns_payload(&payload, false, provider.as_ref()).await?;
            let records =
                build_dns_records(&payload.domain, &payload.target, payload.port, payload.ttl)
                    .map_err(|error| error.to_string())?
                    .into_iter()
                    .zip(record_ids.iter())
                    .map(|(record, provider_record_id)| DnsRecordInsert {
                        record_type: match record.record_type {
                            qianfu_providers::DnsRecordType::A => "A",
                            qianfu_providers::DnsRecordType::Aaaa => "AAAA",
                            qianfu_providers::DnsRecordType::Cname => "CNAME",
                            qianfu_providers::DnsRecordType::Srv => "SRV",
                        }
                        .to_owned(),
                        name: record.name,
                        content: record.content,
                        ttl: record.ttl as i32,
                        provider_record_id: provider_record_id.clone(),
                    })
                    .collect::<Vec<_>>();
            let applied = storage
                .mark_dns_apply_complete(task.resource_id, &records)
                .await
                .map_err(|error| error.to_string())?;
            payload.record_ids = record_ids;
            if !applied {
                execute_dns_payload(&payload, true, provider.as_ref()).await?;
            }
            let payload = serde_json::to_value(TaskPayload::DnsApply(payload))
                .map_err(|error| error.to_string())?;
            storage
                .complete_task_with_payload(task.id, &payload)
                .await
                .map_err(|error| error.to_string())?
        }
        TaskPayload::DnsDelete(payload) => {
            if storage
                .has_active_dns_apply(task.resource_id)
                .await
                .map_err(|error| error.to_string())?
            {
                return fail_task(
                    storage,
                    task,
                    "waiting for DNS creation task to finish before revocation".to_owned(),
                )
                .await;
            }
            let provider = dns_provider(&payload, config)?;
            execute_dns_payload(&payload, true, provider.as_ref()).await?;
            storage
                .mark_dns_delete_complete(task.resource_id)
                .await
                .map_err(|error| error.to_string())?;
            storage
                .complete_task(task.id)
                .await
                .map_err(|error| error.to_string())?
        }
        TaskPayload::ProbeMinecraft(payload) => {
            let probe = probe_server(&payload.host, payload.port, &payload.edition, 5_000).await;
            match probe {
                Ok(_) => {
                    storage
                        .record_probe_result_if_current(
                            task.resource_id,
                            &payload.host,
                            payload.port,
                            true,
                            &payload.edition,
                            None,
                        )
                        .await
                        .map_err(|error| error.to_string())?;
                }
                Err(error) => {
                    storage
                        .record_probe_result_if_current(
                            task.resource_id,
                            &payload.host,
                            payload.port,
                            false,
                            &payload.edition,
                            Some(&error.to_string()),
                        )
                        .await
                        .map_err(|storage_error| storage_error.to_string())?;
                    return fail_task(storage, task, error.to_string()).await;
                }
            }
            storage
                .complete_task(task.id)
                .await
                .map_err(|error| error.to_string())?
        }
        TaskPayload::SendMail(payload) => {
            let account = smtp_account(config)?;
            let message = MailMessage::new(payload.to, payload.subject, payload.text)
                .map_err(|error| error.to_string())?;
            account
                .send_message(&message)
                .await
                .map_err(|error| error.to_string())?;
            storage
                .complete_task(task.id)
                .await
                .map_err(|error| error.to_string())?
        }
        TaskPayload::ProcessMedia(payload) => {
            let client = media_client(config)?;
            let (content_type, bytes) = fetch_media(&payload.source_url).await?;
            validate_media(&content_type, &payload.object_key, &bytes)
                .map_err(|error| error.to_string())?;
            client
                .put(&payload.object_key, &content_type, bytes)
                .await
                .map_err(|error| error.to_string())?;
            storage
                .complete_task(task.id)
                .await
                .map_err(|error| error.to_string())?
        }
        other => {
            return fail_task(
                storage,
                task,
                format!("task provider is not configured: {}", other.kind().as_str()),
            )
            .await;
        }
    };

    if execution {
        Ok(())
    } else {
        Err("task was not running".to_owned())
    }
}

fn media_client(config: &AppConfig) -> Result<R2MediaClient, String> {
    let endpoint = config
        .r2_endpoint
        .as_deref()
        .ok_or_else(|| "R2 media storage is not configured".to_owned())?;
    let bucket = config
        .r2_bucket
        .as_deref()
        .ok_or_else(|| "R2 media storage is not configured".to_owned())?;
    let public_url = config
        .r2_public_url
        .as_deref()
        .ok_or_else(|| "R2 media storage is not configured".to_owned())?;
    let access = config
        .r2_access_key_id
        .clone()
        .ok_or_else(|| "R2 media storage is not configured".to_owned())?;
    let secret = config
        .r2_secret_access_key
        .clone()
        .ok_or_else(|| "R2 media storage is not configured".to_owned())?;
    R2MediaClient::new(endpoint, bucket, public_url, access, secret)
        .map_err(|error| error.to_string())
}

async fn fetch_media(source_url: &str) -> Result<(String, Vec<u8>), String> {
    let source =
        url::Url::parse(source_url).map_err(|_| "media source URL is invalid".to_owned())?;
    if source.scheme() != "https" || source.host_str().is_none() {
        return Err("media source must use HTTPS".to_owned());
    }
    assert_public_source(&source).await?;
    let http = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("media client initialization failed: {error}"))?;
    let mut response = http
        .get(source)
        .send()
        .await
        .map_err(|error| format!("media download failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("media source returned HTTP {}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|size| size > qianfu_providers::MAX_MEDIA_BYTES as u64)
    {
        return Err("media content is too large".to_owned());
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .unwrap_or("")
        .to_owned();
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("media download failed: {error}"))?
    {
        if bytes.len().saturating_add(chunk.len()) > qianfu_providers::MAX_MEDIA_BYTES {
            return Err("media content is too large".to_owned());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok((content_type, bytes))
}

async fn assert_public_source(source: &url::Url) -> Result<(), String> {
    let host = source
        .host_str()
        .ok_or_else(|| "media source URL is invalid".to_owned())?;
    let port = source
        .port_or_known_default()
        .ok_or_else(|| "media source URL has no port".to_owned())?;
    let addresses = tokio::net::lookup_host((host, port))
        .await
        .map_err(|error| format!("media source DNS lookup failed: {error}"))?;
    let mut found = false;
    for address in addresses {
        found = true;
        if !is_public_ip(address.ip()) {
            return Err("media source resolves to a private network".to_owned());
        }
    }
    if !found {
        return Err("media source did not resolve".to_owned());
    }
    Ok(())
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let octets = ip.octets();
            let is_shared = octets[0] == 100 && (64..=127).contains(&octets[1]);
            let is_benchmark = octets[0] == 198 && (18..=19).contains(&octets[1]);
            let is_reserved = octets[0] >= 240;
            let is_special = (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
                || (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
                || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
                || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113);
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || is_ipv4_documentation(ip))
                && !ip.is_multicast()
                && !is_shared
                && !is_benchmark
                && !is_reserved
                && !is_special
        }
        IpAddr::V6(ip) => {
            !(ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_multicast()
                || is_ipv6_documentation(ip))
        }
    }
}

fn is_ipv4_documentation(ip: std::net::Ipv4Addr) -> bool {
    let octets = ip.octets();
    (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
        || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
        || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
}

fn is_ipv6_documentation(ip: std::net::Ipv6Addr) -> bool {
    ip.segments()[0] == 0x2001 && ip.segments()[1] == 0x0db8
}

fn smtp_account(config: &AppConfig) -> Result<MailAccount, String> {
    let host = config
        .smtp_host
        .clone()
        .ok_or_else(|| "SMTP host is not configured".to_owned())?;
    let username = config
        .smtp_username
        .clone()
        .ok_or_else(|| "SMTP username is not configured".to_owned())?;
    let from = config
        .smtp_from
        .clone()
        .ok_or_else(|| "SMTP from address is not configured".to_owned())?;
    let password = config
        .smtp_password
        .clone()
        .ok_or_else(|| "SMTP password is not configured".to_owned())?;
    Ok(MailAccount {
        id: "primary".to_owned(),
        label: "Primary SMTP".to_owned(),
        username,
        password,
        from,
        primary: true,
        enabled: true,
        smtp: SmtpSettings {
            host,
            port: config.smtp_port,
            starttls_port: Some(config.smtp_port),
        },
        pop3: None,
    })
}

fn dns_provider(
    payload: &DnsTaskPayload,
    config: &AppConfig,
) -> Result<Box<dyn DnsProvider>, String> {
    match payload.provider.trim().to_ascii_uppercase().as_str() {
        "CLOUDFLARE" => {
            let token = config
                .cloudflare_api_token
                .clone()
                .ok_or_else(|| "Cloudflare API token is not configured".to_owned())?;
            let zone_id = config
                .cloudflare_zone_id
                .clone()
                .ok_or_else(|| "Cloudflare zone ID is not configured".to_owned())?;
            Ok(Box::new(CloudflareDnsClient::new(token, zone_id)))
        }
        "ALIYUN" => {
            let access_key_id = config
                .aliyun_access_key_id
                .clone()
                .ok_or_else(|| "Alibaba Cloud AccessKey ID is not configured".to_owned())?;
            let access_key_secret = config
                .aliyun_access_key_secret
                .clone()
                .ok_or_else(|| "Alibaba Cloud AccessKey secret is not configured".to_owned())?;
            let endpoint = config
                .aliyun_dns_endpoint
                .clone()
                .unwrap_or_else(|| "https://alidns.aliyuncs.com/".to_owned());
            Ok(Box::new(AliyunDnsClient::new(
                access_key_id,
                access_key_secret,
                endpoint,
                payload.zone.clone(),
            )))
        }
        provider => Err(format!("unsupported DNS provider: {provider}")),
    }
}

async fn fail_task(storage: &PgStorage, task: &StoredTask, error: String) -> Result<(), String> {
    let next_attempt_at = retry_at(Utc::now(), task.attempts);
    storage
        .fail_task(task.id, &error, next_attempt_at)
        .await
        .map_err(|storage_error| storage_error.to_string())?;
    Err(error)
}

pub async fn execute_dns_payload<P: DnsProvider + ?Sized>(
    payload: &DnsTaskPayload,
    deleting: bool,
    provider: &P,
) -> Result<Vec<String>, String> {
    if deleting {
        for record_id in &payload.record_ids {
            provider
                .delete_record(record_id)
                .await
                .map_err(provider_error)?;
        }
        return Ok(Vec::new());
    }

    let records = build_dns_records(&payload.domain, &payload.target, payload.port, payload.ttl)
        .map_err(|error| error.to_string())?;
    let mut record_ids = Vec::with_capacity(records.len());
    for record in records {
        record_ids.push(
            provider
                .ensure_record(&record)
                .await
                .map_err(provider_error)?,
        );
    }
    Ok(record_ids)
}

fn provider_error(error: ProviderError) -> String {
    error.to_string()
}
