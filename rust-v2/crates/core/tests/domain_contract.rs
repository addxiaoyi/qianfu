use qianfu_core::{DomainError, compose_domain};

#[test]
fn compose_domain_normalizes_and_respects_reserved_prefixes() {
    assert_eq!(
        compose_domain(" Play ", ".Example.COM.", &[]).unwrap(),
        "play.example.com"
    );
    assert_eq!(
        compose_domain("admin", "example.com", &["ADMIN".to_owned()]),
        Err(DomainError::ReservedPrefix)
    );
}

#[test]
fn compose_domain_rejects_ambiguous_or_invalid_labels() {
    assert_eq!(
        compose_domain("a..b", "example.com", &[]),
        Err(DomainError::InvalidPrefix)
    );
    assert_eq!(
        compose_domain("play", "localhost", &[]),
        Err(DomainError::InvalidSuffix)
    );
}
