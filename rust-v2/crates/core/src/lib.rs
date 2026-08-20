mod config;
mod domain;
mod pkce;
mod server;

pub use config::{AppConfig, ConfigError, SecretString};
pub use domain::{DomainError, compose_domain};
pub use pkce::{PkceError, PkceVerifier};
pub use server::{NormalizedServerPublish, ServerEdition, ServerError, ServerPublishInput};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    NotFound,
    Unauthorized,
    Forbidden,
    Conflict,
    ValidationError,
    InternalError,
    EmailNotVerified,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct ApiError {
    pub code: ErrorCode,
    pub message: String,
}

impl ApiError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ResponseEnvelope<T> {
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    pub request_id: Uuid,
}

impl<T> ResponseEnvelope<T> {
    pub fn success(request_id: Uuid, data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
            request_id,
        }
    }

    pub fn error(request_id: Uuid, error: ApiError) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(error),
            request_id,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TaskKind {
    DnsApply,
    DnsDelete,
    SendMail,
    ProcessMedia,
    ProbeMinecraft,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TaskPayload {
    DnsApply(DnsTaskPayload),
    DnsDelete(DnsTaskPayload),
    SendMail(MailTaskPayload),
    ProcessMedia(MediaTaskPayload),
    ProbeMinecraft(ProbeTaskPayload),
    DeleteResource { resource_id: Uuid },
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct DnsTaskPayload {
    pub domain: String,
    pub target: String,
    pub port: u16,
    pub ttl: u32,
    pub provider: String,
    pub zone: String,
    pub record_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct MailTaskPayload {
    pub account_id: Uuid,
    pub to: Vec<String>,
    pub subject: String,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct MediaTaskPayload {
    pub asset_id: Uuid,
    pub source_url: String,
    pub object_key: String,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProbeTaskPayload {
    pub server_id: Uuid,
    pub host: String,
    pub port: u16,
    pub edition: String,
}

impl TaskPayload {
    pub fn kind(&self) -> TaskKind {
        match self {
            Self::DnsApply(_) => TaskKind::DnsApply,
            Self::DnsDelete(_) => TaskKind::DnsDelete,
            Self::SendMail(_) => TaskKind::SendMail,
            Self::ProcessMedia(_) => TaskKind::ProcessMedia,
            Self::ProbeMinecraft(_) => TaskKind::ProbeMinecraft,
            Self::DeleteResource { .. } => TaskKind::DnsDelete,
        }
    }

    pub fn resource_id(&self) -> Option<Uuid> {
        match self {
            Self::DnsApply(_) | Self::DnsDelete(_) | Self::SendMail(_) => None,
            Self::ProcessMedia(payload) => Some(payload.asset_id),
            Self::ProbeMinecraft(payload) => Some(payload.server_id),
            Self::DeleteResource { resource_id } => Some(*resource_id),
        }
    }
}

impl TaskKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DnsApply => "dns_apply",
            Self::DnsDelete => "dns_delete",
            Self::SendMail => "send_mail",
            Self::ProcessMedia => "process_media",
            Self::ProbeMinecraft => "probe_minecraft",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TaskStatus {
    Pending,
    Running,
    Failed,
    Succeeded,
}

#[derive(Debug, Clone, Copy, Eq, Error, PartialEq)]
pub enum TaskError {
    #[error("task is already running")]
    AlreadyRunning,
    #[error("task has already finished")]
    AlreadyFinished,
    #[error("task is not running")]
    NotRunning,
    #[error("no handler is registered for this task kind")]
    UnsupportedHandler,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct RetryPolicy {
    max_attempts: u32,
    base_delay_seconds: u64,
    max_delay_seconds: u64,
}

impl RetryPolicy {
    pub fn new(max_attempts: u32, base_delay_seconds: u64, max_delay_seconds: u64) -> Self {
        Self {
            max_attempts: max_attempts.max(1),
            base_delay_seconds,
            max_delay_seconds: max_delay_seconds.max(base_delay_seconds),
        }
    }

    pub fn delay_seconds(self, attempt: u32) -> u64 {
        let multiplier = 2u64.saturating_pow(attempt.saturating_sub(1));
        self.base_delay_seconds
            .saturating_mul(multiplier)
            .min(self.max_delay_seconds)
    }

    fn allows(self, attempts: u32) -> bool {
        attempts < self.max_attempts
    }
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct TaskRecord {
    pub id: Uuid,
    pub kind: TaskKind,
    pub resource_id: String,
    pub status: TaskStatus,
    pub attempts: u32,
    pub last_error: Option<String>,
}

impl TaskRecord {
    pub fn new(kind: TaskKind, resource_id: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            kind,
            resource_id: resource_id.into(),
            status: TaskStatus::Pending,
            attempts: 0,
            last_error: None,
        }
    }

    pub fn idempotency_key(&self) -> String {
        format!("{}:{}", self.kind.as_str(), self.resource_id)
    }

    pub fn status(&self) -> TaskStatus {
        self.status
    }

    pub fn claim(&mut self) -> Result<(), TaskError> {
        match self.status {
            TaskStatus::Pending | TaskStatus::Failed => {
                self.status = TaskStatus::Running;
                self.attempts = self.attempts.saturating_add(1);
                Ok(())
            }
            TaskStatus::Running => Err(TaskError::AlreadyRunning),
            TaskStatus::Succeeded => Err(TaskError::AlreadyFinished),
        }
    }

    pub fn fail(&mut self, message: impl Into<String>) -> Result<(), TaskError> {
        if self.status != TaskStatus::Running {
            return Err(TaskError::NotRunning);
        }

        self.status = TaskStatus::Failed;
        self.last_error = Some(message.into());
        Ok(())
    }

    pub fn succeed(&mut self) -> Result<(), TaskError> {
        if self.status != TaskStatus::Running {
            return if self.status == TaskStatus::Succeeded {
                Err(TaskError::AlreadyFinished)
            } else {
                Err(TaskError::NotRunning)
            };
        }

        self.status = TaskStatus::Succeeded;
        self.last_error = None;
        Ok(())
    }

    pub fn can_retry(&self, policy: &RetryPolicy) -> bool {
        self.status == TaskStatus::Failed && policy.allows(self.attempts)
    }
}
