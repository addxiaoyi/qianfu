use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHash as ArgonPasswordHash, PasswordHasher, PasswordVerifier};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Clone, Copy, Eq, Error, PartialEq)]
pub enum CredentialError {
    #[error("password must be between 6 and 128 characters")]
    InvalidPassword,
    #[error("password hashing failed")]
    HashFailed,
    #[error("session token is invalid")]
    InvalidToken,
    #[error("email address is invalid")]
    InvalidEmail,
}

#[derive(Clone, Eq, PartialEq)]
pub struct PasswordHash(String);

impl std::fmt::Debug for PasswordHash {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

impl PasswordHash {
    pub fn derive(password: &str) -> Result<Self, CredentialError> {
        if !(6..=128).contains(&password.chars().count()) {
            return Err(CredentialError::InvalidPassword);
        }

        let mut salt_bytes = [0_u8; 16];
        getrandom::fill(&mut salt_bytes).map_err(|_| CredentialError::HashFailed)?;
        let salt = SaltString::encode_b64(&salt_bytes).map_err(|_| CredentialError::HashFailed)?;
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| Self(hash.to_string()))
            .map_err(|_| CredentialError::HashFailed)
    }

    pub fn verify(&self, password: &str) -> bool {
        if !(6..=128).contains(&password.chars().count()) {
            return false;
        }
        let Ok(hash) = ArgonPasswordHash::new(&self.0) else {
            return false;
        };
        Argon2::default()
            .verify_password(password.as_bytes(), &hash)
            .is_ok()
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn from_storage(value: &str) -> Option<Self> {
        (!value.trim().is_empty()).then(|| Self(value.to_owned()))
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct SessionToken(String);

#[derive(Clone, Eq, PartialEq)]
pub struct VerificationCode(String);

pub fn normalize_email(value: &str) -> Result<String, CredentialError> {
    let email = value.trim().to_ascii_lowercase();
    let valid = email.len() <= 254
        && email.split('@').count() == 2
        && email.split('@').all(|part| !part.is_empty())
        && email.rsplit_once('@').is_some_and(|(_, domain)| {
            domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
        });
    if valid {
        Ok(email)
    } else {
        Err(CredentialError::InvalidEmail)
    }
}

impl std::fmt::Debug for SessionToken {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

impl SessionToken {
    pub fn generate() -> Self {
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes).expect("operating system randomness is unavailable");
        Self(URL_SAFE_NO_PAD.encode(bytes))
    }

    pub fn parse(value: &str) -> Result<Self, CredentialError> {
        if value.len() != 43 || URL_SAFE_NO_PAD.decode(value).is_err() {
            return Err(CredentialError::InvalidToken);
        }
        Ok(Self(value.to_owned()))
    }

    pub fn expose(&self) -> &str {
        &self.0
    }

    pub fn digest(&self) -> String {
        let digest = Sha256::digest(self.0.as_bytes());
        URL_SAFE_NO_PAD.encode(digest)
    }

    pub fn digest_with_key(&self, key: &str) -> String {
        digest_with_key(self.0.as_bytes(), key)
    }
}

impl std::fmt::Debug for VerificationCode {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

impl VerificationCode {
    const RANGE: u32 = 1_000_000;
    const ACCEPT_LIMIT: u32 = u32::MAX - (u32::MAX % Self::RANGE);

    pub fn generate() -> Self {
        loop {
            let mut bytes = [0_u8; 4];
            getrandom::fill(&mut bytes).expect("operating system randomness is unavailable");
            let value = u32::from_be_bytes(bytes);
            if value < Self::ACCEPT_LIMIT {
                return Self(format!("{:06}", value % Self::RANGE));
            }
        }
    }

    pub fn parse(value: &str) -> Result<Self, CredentialError> {
        if value.len() != 6 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(CredentialError::InvalidToken);
        }
        Ok(Self(value.to_owned()))
    }

    pub fn expose(&self) -> &str {
        &self.0
    }

    pub fn digest(&self) -> String {
        let digest = Sha256::digest(self.0.as_bytes());
        URL_SAFE_NO_PAD.encode(digest)
    }

    pub fn digest_with_key(&self, key: &str) -> String {
        digest_with_key(self.0.as_bytes(), key)
    }
}

fn digest_with_key(value: &[u8], key: &str) -> String {
    let mut mac =
        Hmac::<Sha256>::new_from_slice(key.as_bytes()).expect("HMAC accepts keys of any length");
    mac.update(value);
    URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
}
