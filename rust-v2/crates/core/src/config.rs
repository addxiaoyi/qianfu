use std::{collections::HashMap, env, fmt, ops::Deref};

use thiserror::Error;

#[derive(Clone, Eq, PartialEq)]
pub struct SecretString(String);

impl SecretString {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for SecretString {
    fn as_ref(&self) -> &str {
        self.as_str()
    }
}

impl Deref for SecretString {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        self.as_str()
    }
}

impl From<String> for SecretString {
    fn from(value: String) -> Self {
        Self(value)
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

#[derive(Debug, Clone, Eq, Error, PartialEq)]
pub enum ConfigError {
    #[error("required environment variable is missing: {0}")]
    Missing(String),
    #[error("environment variable must not be empty: {0}")]
    Empty(String),
    #[error("environment variable is invalid: {0}")]
    Invalid(String),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AppConfig {
    pub database_url: SecretString,
    pub session_secret: SecretString,
    pub cloudflare_api_token: Option<SecretString>,
    pub cloudflare_zone_id: Option<String>,
    pub aliyun_access_key_id: Option<SecretString>,
    pub aliyun_access_key_secret: Option<SecretString>,
    pub aliyun_dns_zone: Option<String>,
    pub aliyun_dns_endpoint: Option<String>,
    pub smtp_password: Option<SecretString>,
    pub smtp_host: Option<String>,
    pub smtp_port: u16,
    pub smtp_username: Option<String>,
    pub smtp_from: Option<String>,
    pub github_client_secret: Option<SecretString>,
    pub github_client_id: Option<String>,
    pub github_redirect_uri: Option<String>,
    pub frontend_url: Option<String>,
    pub r2_endpoint: Option<String>,
    pub r2_bucket: Option<String>,
    pub r2_public_url: Option<String>,
    pub r2_access_key_id: Option<SecretString>,
    pub r2_secret_access_key: Option<SecretString>,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_vars(env::vars())
    }

    pub fn from_vars<I, K, V>(values: I) -> Result<Self, ConfigError>
    where
        I: IntoIterator<Item = (K, V)>,
        K: AsRef<str>,
        V: Into<String>,
    {
        let values = values
            .into_iter()
            .map(|(key, value)| (key.as_ref().to_owned(), value.into()))
            .collect::<HashMap<_, _>>();

        Ok(Self {
            database_url: required(&values, "QF_DATABASE_URL")?,
            session_secret: session_secret(&values)?,
            cloudflare_api_token: optional(&values, "QF_CLOUDFLARE_API_TOKEN")?,
            cloudflare_zone_id: optional_plain(&values, "QF_CLOUDFLARE_ZONE_ID"),
            aliyun_access_key_id: optional(&values, "QF_ALIYUN_ACCESS_KEY_ID")?,
            aliyun_access_key_secret: optional(&values, "QF_ALIYUN_ACCESS_KEY_SECRET")?,
            aliyun_dns_zone: optional_plain(&values, "QF_ALIYUN_DNS_ZONE"),
            aliyun_dns_endpoint: optional_plain(&values, "QF_ALIYUN_DNS_ENDPOINT"),
            smtp_password: optional(&values, "QF_SMTP_PASSWORD")?,
            smtp_host: optional_plain(&values, "QF_SMTP_HOST"),
            smtp_port: smtp_port(&values)?,
            smtp_username: optional_plain(&values, "QF_SMTP_USERNAME"),
            smtp_from: optional_plain(&values, "QF_SMTP_FROM"),
            github_client_secret: optional(&values, "QF_GITHUB_CLIENT_SECRET")?,
            github_client_id: optional_plain(&values, "QF_GITHUB_CLIENT_ID"),
            github_redirect_uri: optional_plain(&values, "QF_GITHUB_REDIRECT_URI"),
            frontend_url: optional_plain(&values, "QF_FRONTEND_URL"),
            r2_endpoint: optional_plain(&values, "QF_R2_ENDPOINT"),
            r2_bucket: optional_plain(&values, "QF_R2_BUCKET"),
            r2_public_url: optional_plain(&values, "QF_R2_PUBLIC_URL"),
            r2_access_key_id: optional(&values, "QF_R2_ACCESS_KEY_ID")?,
            r2_secret_access_key: optional(&values, "QF_R2_SECRET_ACCESS_KEY")?,
        })
    }
}

fn session_secret(values: &HashMap<String, String>) -> Result<SecretString, ConfigError> {
    let secret = required(values, "QF_SESSION_SECRET")?;
    if secret.as_str().len() < 32 {
        return Err(ConfigError::Invalid("QF_SESSION_SECRET".to_owned()));
    }
    Ok(secret)
}

fn smtp_port(values: &HashMap<String, String>) -> Result<u16, ConfigError> {
    let Some(value) = optional_plain(values, "QF_SMTP_PORT") else {
        return Ok(587);
    };
    value
        .parse::<u16>()
        .ok()
        .filter(|port| *port > 0)
        .ok_or_else(|| ConfigError::Invalid("QF_SMTP_PORT".to_owned()))
}

fn required(values: &HashMap<String, String>, key: &str) -> Result<SecretString, ConfigError> {
    let value = values
        .get(key)
        .ok_or_else(|| ConfigError::Missing(key.to_owned()))?;
    if value.trim().is_empty() {
        return Err(ConfigError::Empty(key.to_owned()));
    }
    Ok(value.clone().into())
}

fn optional(
    values: &HashMap<String, String>,
    key: &str,
) -> Result<Option<SecretString>, ConfigError> {
    values
        .get(key)
        .filter(|value| !value.trim().is_empty())
        .map(|value| Ok(Some(value.clone().into())))
        .unwrap_or(Ok(None))
}

fn optional_plain(values: &HashMap<String, String>, key: &str) -> Option<String> {
    values
        .get(key)
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}
