use qianfu_auth::{CredentialError, PasswordHash, SessionToken, VerificationCode, normalize_email};

#[test]
fn password_hash_verifies_only_the_original_password() {
    let hash = PasswordHash::derive("correct horse battery staple").unwrap();

    assert!(hash.verify("correct horse battery staple"));
    assert!(!hash.verify("wrong password"));
    assert!(!format!("{hash:?}").contains("correct horse"));
}

#[test]
fn session_token_is_random_but_hash_is_stable() {
    let first = SessionToken::generate();
    let second = SessionToken::generate();

    assert_ne!(first.expose(), second.expose());
    assert_eq!(first.digest(), first.digest());
    assert_ne!(first.digest(), second.digest());
    assert!(SessionToken::parse("").is_err());
}

#[test]
fn verification_code_is_six_digits_and_hashable() {
    let code = VerificationCode::generate();

    assert_eq!(code.expose().len(), 6);
    assert!(code.expose().bytes().all(|byte| byte.is_ascii_digit()));
    assert_eq!(VerificationCode::parse(code.expose()).unwrap(), code);
    assert_eq!(code.digest(), code.digest());
    assert!(VerificationCode::parse("12345").is_err());
    assert!(VerificationCode::parse("1234567").is_err());
    assert!(VerificationCode::parse("123a56").is_err());
}

#[test]
fn password_hash_rejects_empty_input() {
    assert_eq!(
        PasswordHash::derive(""),
        Err(CredentialError::InvalidPassword)
    );
}

#[test]
fn password_hash_rejects_oversized_input() {
    assert_eq!(
        PasswordHash::derive(&"a".repeat(129)),
        Err(CredentialError::InvalidPassword)
    );
}

#[test]
fn password_verification_rejects_out_of_policy_input() {
    let hash = PasswordHash::derive("correct horse battery staple").unwrap();
    assert!(!hash.verify("short"));
    assert!(!hash.verify(&"a".repeat(129)));
}

#[test]
fn email_normalization_is_strict_and_case_insensitive() {
    assert_eq!(
        normalize_email(" User@Example.COM ").unwrap(),
        "user@example.com"
    );
    assert_eq!(
        normalize_email("not-an-email"),
        Err(CredentialError::InvalidEmail)
    );
}
