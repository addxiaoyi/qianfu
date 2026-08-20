use qianfu_core::{PkceError, PkceVerifier};

const VERIFIER: &str = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE: &str = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

#[test]
fn verifier_matches_s256_challenge() {
    let verifier = PkceVerifier::parse(VERIFIER).unwrap();

    assert!(verifier.matches(CHALLENGE));
}

#[test]
fn verifier_rejects_wrong_challenge() {
    let verifier = PkceVerifier::parse(VERIFIER).unwrap();

    assert!(!verifier.matches("wrong-challenge"));
}

#[test]
fn verifier_rejects_invalid_characters_and_length() {
    assert_eq!(
        PkceVerifier::parse("short"),
        Err(PkceError::InvalidVerifier)
    );
    assert_eq!(
        PkceVerifier::parse(&"x".repeat(43).replace('x', "!")),
        Err(PkceError::InvalidVerifier)
    );
}
