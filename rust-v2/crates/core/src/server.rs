use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerEdition {
    Java,
    Bedrock,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct ServerPublishInput {
    pub name: String,
    pub description: String,
    pub edition: ServerEdition,
    pub category: Option<String>,
    pub version: Option<String>,
    pub host: String,
    pub port: Option<u16>,
    pub qq_group: Option<String>,
    pub cover_url: Option<String>,
}

#[derive(Debug, Clone, Eq, Error, PartialEq)]
pub enum ServerError {
    #[error("server name is invalid")]
    InvalidName,
    #[error("server description is invalid")]
    InvalidDescription,
    #[error("server address is invalid")]
    InvalidHost,
    #[error("private server addresses cannot be published")]
    PrivateHost,
    #[error("server port is invalid")]
    InvalidPort,
    #[error("QQ group number is invalid")]
    InvalidQqGroup,
    #[error("cover URL must use HTTP or HTTPS")]
    InvalidCoverUrl,
    #[error("server category is invalid")]
    InvalidCategory,
    #[error("server version is invalid")]
    InvalidVersion,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize)]
pub struct NormalizedServerPublish {
    pub name: String,
    pub description: String,
    pub edition: ServerEdition,
    pub category: Option<String>,
    pub version: Option<String>,
    pub host: String,
    pub port: u16,
    pub qq_group: Option<String>,
    pub cover_url: Option<String>,
}

impl ServerPublishInput {
    pub fn normalize(&self) -> Result<NormalizedServerPublish, ServerError> {
        let name = trimmed_text(&self.name, 100).ok_or(ServerError::InvalidName)?;
        let description =
            trimmed_text(&self.description, 5_000).ok_or(ServerError::InvalidDescription)?;
        let host = normalize_host(&self.host)?;
        let category = optional_text(self.category.as_deref(), 64, ServerError::InvalidCategory)?;
        let version = optional_text(self.version.as_deref(), 64, ServerError::InvalidVersion)?;
        let port = self.port.unwrap_or(match self.edition {
            ServerEdition::Java => 25_565,
            ServerEdition::Bedrock => 19_132,
        });
        if port == 0 {
            return Err(ServerError::InvalidPort);
        }

        let qq_group = self
            .qq_group
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        if qq_group.as_deref().is_some_and(|value| !is_qq_group(value)) {
            return Err(ServerError::InvalidQqGroup);
        }

        let cover_url = self
            .cover_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        if cover_url
            .as_deref()
            .is_some_and(|value| !is_http_url(value))
        {
            return Err(ServerError::InvalidCoverUrl);
        }

        Ok(NormalizedServerPublish {
            name,
            description,
            edition: self.edition,
            category,
            version,
            host,
            port,
            qq_group,
            cover_url,
        })
    }
}

fn optional_text(
    value: Option<&str>,
    max_bytes: usize,
    invalid: ServerError,
) -> Result<Option<String>, ServerError> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if value.len() > max_bytes || value.contains('\u{0}') {
        return Err(invalid);
    }
    Ok(Some(value.to_owned()))
}

fn trimmed_text(value: &str, max_bytes: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.len() <= max_bytes && !value.contains('\u{0}'))
        .then(|| value.to_owned())
}

fn normalize_host(value: &str) -> Result<String, ServerError> {
    let host = value.trim();
    if host.is_empty() || host.len() > 253 || host.chars().any(char::is_whitespace) {
        return Err(ServerError::InvalidHost);
    }

    if let Ok(address) = host.parse::<IpAddr>() {
        return if is_private_target(address) {
            Err(ServerError::PrivateHost)
        } else {
            Ok(host.to_owned())
        };
    }

    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return Err(ServerError::PrivateHost);
    }

    let valid_domain = host.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    });
    if !valid_domain || !host.contains('.') {
        return Err(ServerError::InvalidHost);
    }

    Ok(host.to_ascii_lowercase())
}

fn is_private_target(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => is_private_ipv4(address),
        IpAddr::V6(address) => is_private_ipv6(address),
    }
}

fn is_private_ipv4(address: Ipv4Addr) -> bool {
    let octets = address.octets();
    octets[0] == 0
        || octets[0] == 10
        || octets[0] == 127
        || (octets[0] == 100 && (64..=127).contains(&octets[1]))
        || (octets[0] == 169 && octets[1] == 254)
        || (octets[0] == 172 && (16..=31).contains(&octets[1]))
        || (octets[0] == 192 && octets[1] == 168)
        || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
        || (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
        || (octets[0] == 192 && octets[1] == 88 && octets[2] == 99)
        || (octets[0] == 198 && (18..=19).contains(&octets[1]))
        || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
        || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
        || octets[0] >= 224
}

fn is_private_ipv6(address: Ipv6Addr) -> bool {
    let segments = address.segments();
    address.is_loopback()
        || address.is_unspecified()
        || address.is_multicast()
        || (segments[0] == 0x2001 && segments[1] == 0x0db8)
        || (segments[0] & 0xfe00 == 0xfc00)
        || (segments[0] & 0xffc0 == 0xfe80)
        || address.to_ipv4().is_some_and(is_private_ipv4)
}

fn is_qq_group(value: &str) -> bool {
    (5..=12).contains(&value.len()) && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn is_http_url(value: &str) -> bool {
    value.len() <= 2_048
        && !value.chars().any(char::is_whitespace)
        && (value.starts_with("https://") || value.starts_with("http://"))
}
