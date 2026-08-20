use qianfu_core::{AppConfig, ConfigError};

fn vars(extra: &[(&str, &str)]) -> Vec<(String, String)> {
    let mut values = vec![
        (
            "QF_DATABASE_URL".to_owned(),
            "postgres://app:secret@db/qianfu".to_owned(),
        ),
        (
            "QF_SESSION_SECRET".to_owned(),
            "session-secret-with-at-least-thirty-two-bytes".to_owned(),
        ),
    ];
    values.extend(
        extra
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned())),
    );
    values
}

#[test]
fn config_requires_database_and_session_secrets() {
    let values = vec![("QF_DATABASE_URL".to_owned(), "postgres://db".to_owned())];

    assert_eq!(
        AppConfig::from_vars(values),
        Err(ConfigError::Missing("QF_SESSION_SECRET".to_owned()))
    );
}

#[test]
fn config_rejects_weak_session_secrets_and_invalid_smtp_ports() {
    assert_eq!(
        AppConfig::from_vars(vars(&[("QF_SESSION_SECRET", "too-short")])),
        Err(ConfigError::Invalid("QF_SESSION_SECRET".to_owned()))
    );
    assert_eq!(
        AppConfig::from_vars(vars(&[("QF_SMTP_PORT", "not-a-port")])),
        Err(ConfigError::Invalid("QF_SMTP_PORT".to_owned()))
    );
}

#[test]
fn config_reads_optional_provider_credentials_from_environment() {
    let config = AppConfig::from_vars(vars(&[
        ("QF_CLOUDFLARE_API_TOKEN", "cf-token"),
        ("QF_ALIYUN_ACCESS_KEY_ID", "access-id"),
        ("QF_ALIYUN_ACCESS_KEY_SECRET", "access-secret"),
    ]))
    .unwrap();

    assert_eq!(config.cloudflare_api_token.as_deref(), Some("cf-token"));
    assert_eq!(config.aliyun_access_key_id.as_deref(), Some("access-id"));
    assert_eq!(
        config.aliyun_access_key_secret.as_deref(),
        Some("access-secret")
    );
}

#[test]
fn config_debug_output_redacts_secrets() {
    let config = AppConfig::from_vars(vars(&[
        (
            "QF_SESSION_SECRET",
            "super-secret-with-at-least-thirty-two-bytes",
        ),
        ("QF_CLOUDFLARE_API_TOKEN", "cf-token"),
    ]))
    .unwrap();
    let debug = format!("{config:?}");

    assert!(debug.contains("[REDACTED]"));
    assert!(!debug.contains("super-secret-with-at-least-thirty-two-bytes"));
    assert!(!debug.contains("cf-token"));
}

#[test]
fn config_reads_r2_settings_without_exposing_credentials() {
    let config = AppConfig::from_vars(vars(&[
        ("QF_R2_ENDPOINT", "https://r2.example.test"),
        ("QF_R2_BUCKET", "qianfu-media"),
        ("QF_R2_PUBLIC_URL", "https://cdn.example.test"),
        ("QF_R2_ACCESS_KEY_ID", "access-id"),
        ("QF_R2_SECRET_ACCESS_KEY", "secret-key"),
    ]))
    .unwrap();
    assert_eq!(config.r2_bucket.as_deref(), Some("qianfu-media"));
    let debug = format!("{config:?}");
    assert!(!debug.contains("access-id"));
    assert!(!debug.contains("secret-key"));
}

#[test]
fn config_reads_github_oauth_settings_without_exposing_secret() {
    let config = AppConfig::from_vars(vars(&[
        ("QF_GITHUB_CLIENT_ID", "client-id"),
        ("QF_GITHUB_CLIENT_SECRET", "client-secret"),
        (
            "QF_GITHUB_REDIRECT_URI",
            "https://api.example.test/api/v2/auth/github/callback",
        ),
        ("QF_FRONTEND_URL", "https://app.example.test"),
    ]))
    .unwrap();

    assert_eq!(config.github_client_id.as_deref(), Some("client-id"));
    assert_eq!(
        config.frontend_url.as_deref(),
        Some("https://app.example.test")
    );
    assert!(!format!("{config:?}").contains("client-secret"));
}
