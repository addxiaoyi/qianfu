use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Clone, Copy, Eq, Error, PartialEq)]
pub enum PkceError {
    #[error("PKCE verifier must be 43-128 RFC 7636 characters")]
    InvalidVerifier,
}

#[derive(Clone, Eq, PartialEq)]
pub struct PkceVerifier(String);

impl std::fmt::Debug for PkceVerifier {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

impl PkceVerifier {
    pub fn parse(value: &str) -> Result<Self, PkceError> {
        if !(43..=128).contains(&value.len())
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"-._~".contains(&byte))
        {
            return Err(PkceError::InvalidVerifier);
        }

        Ok(Self(value.to_owned()))
    }

    pub fn matches(&self, challenge: &str) -> bool {
        let digest = Sha256::digest(self.0.as_bytes());
        URL_SAFE_NO_PAD.encode(digest) == challenge
    }
}
