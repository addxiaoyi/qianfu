use thiserror::Error;

#[derive(Debug, Error, Eq, PartialEq)]
pub enum DomainError {
    #[error("domain prefix is invalid")]
    InvalidPrefix,
    #[error("domain suffix is invalid")]
    InvalidSuffix,
    #[error("domain prefix is reserved")]
    ReservedPrefix,
}

pub fn compose_domain(
    prefix: &str,
    suffix: &str,
    reserved_prefixes: &[String],
) -> Result<String, DomainError> {
    let prefix = prefix.trim().to_ascii_lowercase();
    let suffix = suffix.trim().trim_matches('.').to_ascii_lowercase();
    if !is_label(&prefix) {
        return Err(DomainError::InvalidPrefix);
    }
    if !is_domain(&suffix) {
        return Err(DomainError::InvalidSuffix);
    }
    if reserved_prefixes
        .iter()
        .any(|reserved| reserved.eq_ignore_ascii_case(&prefix))
    {
        return Err(DomainError::ReservedPrefix);
    }
    Ok(format!("{prefix}.{suffix}"))
}

fn is_label(value: &str) -> bool {
    (1..=63).contains(&value.len())
        && !value.starts_with('-')
        && !value.ends_with('-')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

fn is_domain(value: &str) -> bool {
    value.len() <= 253 && value.split('.').count() >= 2 && value.split('.').all(is_label)
}
