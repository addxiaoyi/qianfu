use qianfu_core::SecretString;
use qianfu_providers::{ProviderError, R2MediaClient};

#[test]
fn r2_client_requires_https_and_returns_invalid_target_for_bad_bucket() {
    let access = SecretString::from("access".to_owned());
    let secret = SecretString::from("secret".to_owned());
    assert!(matches!(
        R2MediaClient::new(
            "http://storage.test",
            "media",
            "https://cdn.test",
            access.clone(),
            secret.clone()
        ),
        Err(ProviderError::InvalidTarget)
    ));
    assert!(matches!(
        R2MediaClient::new(
            "https://storage.test",
            "bad/bucket",
            "https://cdn.test",
            access,
            secret
        ),
        Err(ProviderError::InvalidTarget)
    ));
}
