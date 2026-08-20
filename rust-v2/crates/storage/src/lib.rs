use chrono::{DateTime, Utc};
use qianfu_core::{DnsTaskPayload, ProbeTaskPayload, TaskPayload, compose_domain};
use serde_json::Value;
use sqlx::{FromRow, PgPool, postgres::PgPoolOptions};
use thiserror::Error;
use uuid::Uuid;

pub use qianfu_core::ServerEdition;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("database migration failed")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("record was not found")]
    NotFound,
    #[error("server port is outside the supported range")]
    InvalidServerPort,
    #[error("task payload could not be serialized")]
    TaskPayload(#[from] serde_json::Error),
    #[error("domain request is invalid")]
    InvalidDomain,
    #[error("domain quota has been reached")]
    DomainQuotaReached,
    #[error("operation is temporarily rate limited")]
    Conflict,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ServerStatus {
    PendingReview,
    Approved,
    Rejected,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum DeleteServerOutcome {
    Deleted,
    PendingDnsRevoke,
}

impl ServerStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::PendingReview => "PENDING",
            Self::Approved => "APPROVED",
            Self::Rejected => "REJECTED",
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct NewServer {
    pub owner_id: i64,
    pub name: String,
    pub description: String,
    pub edition: ServerEdition,
    pub host: String,
    pub port: i32,
    pub qq_group: Option<String>,
    pub cover_url: Option<String>,
    pub status: ServerStatus,
}

impl NewServer {
    pub fn new(
        owner_id: i64,
        name: impl Into<String>,
        host: impl Into<String>,
        edition: ServerEdition,
    ) -> Self {
        Self {
            owner_id,
            name: name.into(),
            description: String::new(),
            edition,
            host: host.into(),
            port: match edition {
                ServerEdition::Java => 25_565,
                ServerEdition::Bedrock => 19_132,
            },
            qq_group: None,
            cover_url: None,
            status: ServerStatus::PendingReview,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct UserRecord {
    pub id: i64,
    pub email: String,
    pub password_hash: Option<String>,
    pub display_name: Option<String>,
    pub role: String,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct SessionRecord {
    pub id: Uuid,
    pub user_id: i64,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
pub struct ServerRecord {
    pub id: Uuid,
    pub owner_id: i64,
    pub name: String,
    pub description: String,
    pub edition: String,
    pub host: String,
    pub port: i32,
    pub qq_group: Option<String>,
    pub cover_url: Option<String>,
    pub review_status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub probe_reachable: Option<bool>,
    pub probe_edition: Option<String>,
    pub probe_error: Option<String>,
    pub probe_checked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, FromRow)]
pub struct PublicStats {
    pub total_servers: i64,
    pub total_users: i64,
    pub online_nodes: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct CheckinState {
    pub checked_in_today: bool,
    pub streak_days: i64,
    pub checkin_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
pub struct TaskRecord {
    pub id: Uuid,
    pub kind: String,
    pub resource_id: Uuid,
    pub idempotency_key: String,
    pub payload: Value,
    pub status: String,
    pub attempts: i32,
    pub next_attempt_at: DateTime<Utc>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DnsSuffixRecord {
    pub id: Uuid,
    pub suffix: String,
    pub provider: String,
    pub zone: String,
    pub ttl: i32,
    pub quota_per_user: i32,
    pub reserved_prefixes: Value,
    pub enabled: bool,
}

#[derive(Debug, Clone, FromRow)]
pub struct ServerDomainRecord {
    pub id: Uuid,
    pub server_id: Uuid,
    pub owner_id: i64,
    pub suffix_id: Uuid,
    pub prefix: String,
    pub domain: String,
    pub target: String,
    pub port: i32,
    pub application_status: String,
    pub dns_status: String,
    pub reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct DnsRecordInsert {
    pub record_type: String,
    pub name: String,
    pub content: String,
    pub ttl: i32,
    pub provider_record_id: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct TaskInsert {
    pub kind: String,
    pub resource_id: Uuid,
    pub idempotency_key: String,
    pub payload: Value,
    pub attempts: i32,
}

impl TaskInsert {
    pub fn new(kind: impl Into<String>, resource_id: Uuid) -> Self {
        let kind = kind.into();
        Self {
            idempotency_key: format!("{kind}:{resource_id}"),
            kind,
            resource_id,
            payload: Value::Null,
            attempts: 0,
        }
    }

    pub fn with_payload(
        kind: impl Into<String>,
        resource_id: Uuid,
        payload: &TaskPayload,
    ) -> Result<Self, serde_json::Error> {
        let mut task = Self::new(kind, resource_id);
        task.payload = serde_json::to_value(payload)?;
        Ok(task)
    }
}

#[derive(Clone)]
pub struct PgStorage {
    pool: PgPool,
}

impl PgStorage {
    pub fn connect_lazy(database_url: &str, max_connections: u32) -> Result<Self, StorageError> {
        let pool = PgPoolOptions::new()
            .max_connections(max_connections)
            .connect_lazy(database_url)?;
        Ok(Self { pool })
    }

    pub async fn connect(database_url: &str, max_connections: u32) -> Result<Self, StorageError> {
        let pool = PgPoolOptions::new()
            .max_connections(max_connections)
            .connect(database_url)
            .await?;
        Ok(Self { pool })
    }

    pub async fn migrate(&self) -> Result<(), StorageError> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        Ok(())
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn ping(&self) -> Result<(), StorageError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map(|_| ())
            .map_err(StorageError::Database)
    }

    pub async fn list_dns_suffixes(&self) -> Result<Vec<DnsSuffixRecord>, StorageError> {
        Ok(sqlx::query_as("SELECT id, suffix, provider, zone, ttl, quota_per_user, reserved_prefixes, enabled FROM dns_suffixes WHERE enabled = TRUE ORDER BY suffix")
            .fetch_all(&self.pool).await?)
    }

    pub async fn create_dns_suffix(
        &self,
        suffix: &str,
        provider: &str,
        zone: &str,
        ttl: i32,
        quota: i32,
        reserved_prefixes: &Value,
    ) -> Result<DnsSuffixRecord, StorageError> {
        Ok(sqlx::query_as("INSERT INTO dns_suffixes (suffix, provider, zone, ttl, quota_per_user, reserved_prefixes) VALUES (lower($1), $2, lower($3), $4, $5, $6) RETURNING id, suffix, provider, zone, ttl, quota_per_user, reserved_prefixes, enabled")
            .bind(suffix.trim().trim_matches('.')).bind(provider).bind(zone.trim().trim_matches('.')).bind(ttl).bind(quota).bind(reserved_prefixes).fetch_one(&self.pool).await?)
    }

    pub async fn request_server_domain(
        &self,
        server_id: Uuid,
        owner_id: i64,
        suffix_id: Uuid,
        prefix: &str,
        target: &str,
        port: i32,
    ) -> Result<ServerDomainRecord, StorageError> {
        let mut tx = self.pool.begin().await?;
        let suffix: DnsSuffixRecord = sqlx::query_as("SELECT id, suffix, provider, zone, ttl, quota_per_user, reserved_prefixes, enabled FROM dns_suffixes WHERE id = $1 AND enabled = TRUE FOR UPDATE")
            .bind(suffix_id).fetch_optional(&mut *tx).await?.ok_or(StorageError::NotFound)?;
        let reserved: Vec<String> = serde_json::from_value(suffix.reserved_prefixes.clone())
            .map_err(StorageError::TaskPayload)?;
        let domain = compose_domain(prefix, &suffix.suffix, &reserved)
            .map_err(|_| StorageError::InvalidDomain)?;
        let used: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM server_domains WHERE owner_id = $1 AND application_status NOT IN ('REJECTED', 'REVOKED')")
            .bind(owner_id).fetch_one(&mut *tx).await?;
        if used >= i64::from(suffix.quota_per_user) {
            tx.rollback().await?;
            return Err(StorageError::DomainQuotaReached);
        }
        let record = sqlx::query_as("INSERT INTO server_domains (server_id, owner_id, suffix_id, prefix, domain, target, port) SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM servers WHERE id = $1 AND owner_id = $2) RETURNING id, server_id, owner_id, suffix_id, prefix, domain, target, port, application_status, dns_status, reviewed_at")
            .bind(server_id).bind(owner_id).bind(suffix_id).bind(prefix.trim().to_ascii_lowercase()).bind(domain).bind(target.trim()).bind(port).fetch_optional(&mut *tx).await?.ok_or(StorageError::NotFound)?;
        tx.commit().await?;
        Ok(record)
    }

    pub async fn find_server_domain_owned(
        &self,
        server_id: Uuid,
        owner_id: i64,
    ) -> Result<Option<ServerDomainRecord>, StorageError> {
        Ok(sqlx::query_as("SELECT id, server_id, owner_id, suffix_id, prefix, domain, target, port, application_status, dns_status, reviewed_at FROM server_domains WHERE server_id = $1 AND owner_id = $2")
            .bind(server_id).bind(owner_id).fetch_optional(&self.pool).await?)
    }

    pub async fn approve_server_domain(
        &self,
        server_id: Uuid,
    ) -> Result<Option<ServerDomainRecord>, StorageError> {
        let mut tx = self.pool.begin().await?;
        let record: Option<ServerDomainRecord> = sqlx::query_as("UPDATE server_domains SET application_status = 'APPROVED', dns_status = 'PENDING', reviewed_at = now(), updated_at = now() WHERE server_id = $1 AND application_status = 'PENDING_REVIEW' RETURNING id, server_id, owner_id, suffix_id, prefix, domain, target, port, application_status, dns_status, reviewed_at")
            .bind(server_id).fetch_optional(&mut *tx).await?;
        let Some(record) = record else {
            tx.rollback().await?;
            return Ok(None);
        };
        let suffix: DnsSuffixRecord = sqlx::query_as("SELECT id, suffix, provider, zone, ttl, quota_per_user, reserved_prefixes, enabled FROM dns_suffixes WHERE id = $1")
            .bind(record.suffix_id).fetch_one(&mut *tx).await?;
        let payload = TaskPayload::DnsApply(DnsTaskPayload {
            domain: record.domain.clone(),
            target: record.target.clone(),
            port: u16::try_from(record.port).map_err(|_| StorageError::InvalidServerPort)?,
            ttl: u32::try_from(suffix.ttl).map_err(|_| StorageError::InvalidServerPort)?,
            provider: suffix.provider,
            zone: suffix.zone,
            record_ids: Vec::new(),
        });
        let task = TaskInsert::with_payload("dns_apply", record.id, &payload)?;
        sqlx::query("INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts, status, next_attempt_at) VALUES ($1, $2, $3, $4, 0, 'PENDING', now()) ON CONFLICT (idempotency_key) DO UPDATE SET payload = EXCLUDED.payload, status = 'PENDING', attempts = 0, next_attempt_at = now(), last_error = NULL")
            .bind(task.kind).bind(task.resource_id).bind(task.idempotency_key).bind(task.payload).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(Some(record))
    }

    pub async fn revoke_server_domain_owned(
        &self,
        server_id: Uuid,
        owner_id: i64,
    ) -> Result<bool, StorageError> {
        let mut tx = self.pool.begin().await?;
        let record: Option<ServerDomainRecord> = sqlx::query_as("UPDATE server_domains SET application_status = 'REVOKED', dns_status = 'REVOKE_PENDING', updated_at = now() WHERE server_id = $1 AND owner_id = $2 AND application_status <> 'REVOKED' RETURNING id, server_id, owner_id, suffix_id, prefix, domain, target, port, application_status, dns_status, reviewed_at")
            .bind(server_id).bind(owner_id).fetch_optional(&mut *tx).await?;
        let Some(record) = record else {
            tx.rollback().await?;
            return Ok(false);
        };
        let suffix: DnsSuffixRecord = sqlx::query_as("SELECT id, suffix, provider, zone, ttl, quota_per_user, reserved_prefixes, enabled FROM dns_suffixes WHERE id = $1")
            .bind(record.suffix_id).fetch_one(&mut *tx).await?;
        let ids: Vec<String> = sqlx::query_scalar("SELECT provider_record_id FROM dns_records WHERE server_domain_id = $1 AND created_by_platform = TRUE AND provider_record_id IS NOT NULL AND status <> 'DELETED'")
            .bind(record.id).fetch_all(&mut *tx).await?;
        let payload = TaskPayload::DnsDelete(DnsTaskPayload {
            domain: record.domain,
            target: record.target,
            port: u16::try_from(record.port).map_err(|_| StorageError::InvalidServerPort)?,
            ttl: u32::try_from(suffix.ttl).map_err(|_| StorageError::InvalidServerPort)?,
            provider: suffix.provider,
            zone: suffix.zone,
            record_ids: ids,
        });
        let task = TaskInsert::with_payload("dns_delete", record.id, &payload)?;
        sqlx::query("INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts, status, next_attempt_at) VALUES ($1, $2, $3, $4, 0, 'PENDING', now()) ON CONFLICT (idempotency_key) DO UPDATE SET payload = EXCLUDED.payload, status = 'PENDING', attempts = 0, next_attempt_at = now(), last_error = NULL")
            .bind(task.kind).bind(task.resource_id).bind(task.idempotency_key).bind(task.payload).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(true)
    }

    pub async fn mark_dns_apply_complete(
        &self,
        domain_id: Uuid,
        records: &[DnsRecordInsert],
    ) -> Result<bool, StorageError> {
        let mut tx = self.pool.begin().await?;
        let is_approved: bool = sqlx::query_scalar(
            "SELECT application_status = 'APPROVED' FROM server_domains WHERE id = $1 FOR UPDATE",
        )
        .bind(domain_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(false);
        if !is_approved {
            tx.commit().await?;
            return Ok(false);
        }
        for record in records {
            sqlx::query("INSERT INTO dns_records (server_domain_id, record_type, name, content, ttl, provider_record_id, created_by_platform, status) VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'ACTIVE') ON CONFLICT (server_domain_id, record_type, name, content) DO UPDATE SET provider_record_id = EXCLUDED.provider_record_id, status = 'ACTIVE', last_error = NULL, updated_at = now()")
                .bind(domain_id).bind(&record.record_type).bind(&record.name).bind(&record.content).bind(record.ttl).bind(&record.provider_record_id).execute(&mut *tx).await?;
        }
        let updated = sqlx::query(
            "UPDATE server_domains SET dns_status = 'ACTIVE', updated_at = now() WHERE id = $1",
        )
        .bind(domain_id)
        .execute(&mut *tx)
        .await?
        .rows_affected()
            == 1;
        tx.commit().await?;
        Ok(updated)
    }

    pub async fn has_active_dns_apply(&self, domain_id: Uuid) -> Result<bool, StorageError> {
        Ok(sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM tasks WHERE kind = 'dns_apply' AND resource_id = $1 AND status IN ('PENDING', 'RUNNING'))",
        )
        .bind(domain_id)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn mark_dns_delete_complete(&self, domain_id: Uuid) -> Result<bool, StorageError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE dns_records SET status = 'DELETED', updated_at = now() WHERE server_domain_id = $1 AND created_by_platform = TRUE")
            .bind(domain_id).execute(&mut *tx).await?;
        let updated = sqlx::query("UPDATE server_domains SET dns_status = 'REVOKED', updated_at = now() WHERE id = $1 AND application_status = 'REVOKED'")
            .bind(domain_id).execute(&mut *tx).await?.rows_affected() == 1;
        sqlx::query("DELETE FROM servers WHERE id = (SELECT server_id FROM server_domains WHERE id = $1 AND delete_after_revoke = TRUE)")
            .bind(domain_id).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(updated)
    }

    pub async fn create_user(
        &self,
        email: &str,
        password_hash: Option<&str>,
        display_name: Option<&str>,
    ) -> Result<UserRecord, StorageError> {
        Ok(sqlx::query_as(
            r#"
            INSERT INTO users (email, password_hash, display_name)
            VALUES (lower($1), $2, $3)
            RETURNING id, email, password_hash, display_name, role, email_verified, created_at
            "#,
        )
        .bind(email.trim())
        .bind(password_hash)
        .bind(display_name)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn register_user_with_verification(
        &self,
        email: &str,
        password_hash: &str,
        display_name: Option<&str>,
        verification_hash: &str,
        verification_expires_at: DateTime<Utc>,
        mail_task: &TaskInsert,
    ) -> Result<UserRecord, StorageError> {
        let mut tx = self.pool.begin().await?;
        let user: UserRecord = sqlx::query_as(
            r#"
            INSERT INTO users (email, password_hash, display_name)
            VALUES (lower($1), $2, $3)
            RETURNING id, email, password_hash, display_name, role, email_verified, created_at
            "#,
        )
        .bind(email.trim())
        .bind(password_hash)
        .bind(display_name)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        )
        .bind(user.id)
        .bind(verification_hash)
        .bind(verification_expires_at)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(&mail_task.kind)
        .bind(mail_task.resource_id)
        .bind(&mail_task.idempotency_key)
        .bind(&mail_task.payload)
        .bind(mail_task.attempts)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(user)
    }

    pub async fn create_github_user(
        &self,
        email: &str,
        display_name: Option<&str>,
    ) -> Result<UserRecord, StorageError> {
        Ok(sqlx::query_as("INSERT INTO users (email, display_name, email_verified) VALUES (lower($1), $2, TRUE) RETURNING id, email, password_hash, display_name, role, email_verified, created_at")
            .bind(email.trim()).bind(display_name).fetch_one(&self.pool).await?)
    }

    pub async fn find_user_by_email(
        &self,
        email: &str,
    ) -> Result<Option<UserRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT id, email, password_hash, display_name, role, email_verified, created_at
            FROM users WHERE email = lower($1)
            "#,
        )
        .bind(email.trim())
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn find_user_by_id(&self, user_id: i64) -> Result<Option<UserRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT id, email, password_hash, display_name, role, email_verified, created_at
            FROM users WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn save_oauth_state(
        &self,
        state_hash: &str,
        verifier: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), StorageError> {
        sqlx::query("INSERT INTO oauth_states (state_hash, provider, code_verifier, expires_at) VALUES ($1, 'github', $2, $3)")
            .bind(state_hash).bind(verifier).bind(expires_at).execute(&self.pool).await?;
        Ok(())
    }

    pub async fn consume_oauth_state(
        &self,
        state_hash: &str,
    ) -> Result<Option<String>, StorageError> {
        Ok(sqlx::query_scalar("UPDATE oauth_states SET consumed_at = now() WHERE state_hash = $1 AND provider = 'github' AND consumed_at IS NULL AND expires_at > now() RETURNING code_verifier")
            .bind(state_hash).fetch_optional(&self.pool).await?)
    }

    pub async fn find_oauth_user(
        &self,
        provider_user_id: &str,
    ) -> Result<Option<UserRecord>, StorageError> {
        Ok(sqlx::query_as("SELECT u.id, u.email, u.password_hash, u.display_name, u.role, u.email_verified, u.created_at FROM oauth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = 'github' AND i.provider_user_id = $1")
            .bind(provider_user_id).fetch_optional(&self.pool).await?)
    }

    pub async fn link_github_identity(
        &self,
        user_id: i64,
        provider_user_id: &str,
    ) -> Result<(), StorageError> {
        sqlx::query("INSERT INTO oauth_identities (provider, provider_user_id, user_id) VALUES ('github', $1, $2)")
            .bind(provider_user_id).bind(user_id).execute(&self.pool).await?;
        Ok(())
    }

    pub async fn create_session(
        &self,
        user_id: i64,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<SessionRecord, StorageError> {
        Ok(sqlx::query_as(
            r#"
            INSERT INTO sessions (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, expires_at, revoked_at
            "#,
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn find_active_session(
        &self,
        token_hash: &str,
    ) -> Result<Option<SessionRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT id, user_id, expires_at, revoked_at
            FROM sessions
            WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
            "#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn revoke_session(&self, session_id: Uuid) -> Result<bool, StorageError> {
        let result = sqlx::query(
            "UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
        )
        .bind(session_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn update_password_and_revoke_sessions(
        &self,
        user_id: i64,
        password_hash: &str,
    ) -> Result<bool, StorageError> {
        let mut tx = self.pool.begin().await?;
        let updated = sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
            .bind(user_id)
            .bind(password_hash)
            .execute(&mut *tx)
            .await?
            .rows_affected();
        if updated == 1 {
            sqlx::query(
                "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
            )
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(updated == 1)
    }

    pub async fn update_display_name(
        &self,
        user_id: i64,
        display_name: Option<&str>,
    ) -> Result<Option<UserRecord>, StorageError> {
        Ok(sqlx::query_as(
            "UPDATE users SET display_name = $2 WHERE id = $1 RETURNING id, email, password_hash, display_name, role, email_verified, created_at",
        )
        .bind(user_id)
        .bind(display_name)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn create_password_reset(
        &self,
        user_id: i64,
        token_hash: &str,
        expires_at: DateTime<Utc>,
        task: &TaskInsert,
    ) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT id FROM users WHERE id = $1 FOR UPDATE")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        let recently_sent = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '60 seconds')",
        ).bind(user_id).fetch_one(&mut *tx).await?;
        if recently_sent {
            return Err(StorageError::Conflict);
        }
        sqlx::query("UPDATE password_resets SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL")
            .bind(user_id).execute(&mut *tx).await?;
        sqlx::query(
            "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts) VALUES ($1, $2, $3, $4, $5)")
            .bind(&task.kind).bind(task.resource_id).bind(&task.idempotency_key).bind(&task.payload).bind(task.attempts)
            .execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn reset_password_with_token(
        &self,
        user_id: i64,
        token_hash: &str,
        password_hash: &str,
    ) -> Result<bool, StorageError> {
        let mut tx = self.pool.begin().await?;
        let consumed = sqlx::query_scalar::<_, Uuid>(
            "UPDATE password_resets SET consumed_at = now() WHERE user_id = $1 AND token_hash = $2 AND consumed_at IS NULL AND failed_attempts < 5 AND expires_at > now() RETURNING id",
        )
        .bind(user_id)
        .bind(token_hash)
        .fetch_optional(&mut *tx)
        .await?
        .is_some();
        if !consumed {
            tx.rollback().await?;
            return Ok(false);
        }
        sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
            .bind(user_id)
            .bind(password_hash)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(true)
    }

    pub async fn record_password_reset_failure(
        &self,
        user_id: i64,
        token_hash: &str,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "UPDATE password_resets SET failed_attempts = failed_attempts + 1, consumed_at = CASE WHEN failed_attempts + 1 >= 5 THEN now() ELSE consumed_at END WHERE user_id = $1 AND token_hash = $2 AND consumed_at IS NULL AND expires_at > now()",
        )
        .bind(user_id)
        .bind(token_hash)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn create_email_verification(
        &self,
        user_id: i64,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "DELETE FROM email_verifications WHERE expires_at <= now() OR consumed_at IS NOT NULL",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "UPDATE email_verifications SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL",
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn create_email_verification_with_task(
        &self,
        user_id: i64,
        token_hash: &str,
        expires_at: DateTime<Utc>,
        task: &TaskInsert,
    ) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT id FROM users WHERE id = $1 FOR UPDATE")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        let recently_sent = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM email_verifications WHERE user_id = $1 AND created_at > now() - interval '60 seconds')",
        )
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;
        if recently_sent {
            return Err(StorageError::Conflict);
        }
        sqlx::query(
            "DELETE FROM email_verifications WHERE expires_at <= now() OR consumed_at IS NOT NULL",
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE email_verifications SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL")
            .bind(user_id).execute(&mut *tx).await?;
        sqlx::query(
            "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts) VALUES ($1, $2, $3, $4, $5)")
            .bind(&task.kind).bind(task.resource_id).bind(&task.idempotency_key).bind(&task.payload).bind(task.attempts)
            .execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn verification_sent_recently(
        &self,
        user_id: i64,
        window_seconds: i64,
    ) -> Result<bool, StorageError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM email_verifications WHERE user_id = $1 AND created_at > now() - ($2 * interval '1 second')",
        )
        .bind(user_id)
        .bind(window_seconds.max(1))
        .fetch_one(&self.pool)
        .await?;
        Ok(count > 0)
    }

    pub async fn consume_email_verification(
        &self,
        email: &str,
        token_hash: &str,
    ) -> Result<bool, StorageError> {
        const MAX_ATTEMPTS: i32 = 5;
        let mut tx = self.pool.begin().await?;
        let user_id: Option<i64> = sqlx::query_scalar(
            r#"
            UPDATE email_verifications AS verification
            SET consumed_at = now()
            FROM users
            WHERE verification.user_id = users.id
              AND users.email = lower($1)
              AND verification.token_hash = $2
              AND verification.consumed_at IS NULL
              AND verification.expires_at > now()
              AND verification.attempts < $3
            RETURNING verification.user_id
            "#,
        )
        .bind(email.trim())
        .bind(token_hash)
        .bind(MAX_ATTEMPTS)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(user_id) = user_id else {
            sqlx::query(
                r#"
                UPDATE email_verifications AS verification
                SET attempts = attempts + 1
                FROM users
                WHERE verification.user_id = users.id
                  AND users.email = lower($1)
                  AND verification.consumed_at IS NULL
                  AND verification.expires_at > now()
                  AND verification.attempts < $2
                "#,
            )
            .bind(email.trim())
            .bind(MAX_ATTEMPTS)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            return Ok(false);
        };

        sqlx::query("UPDATE users SET email_verified = TRUE WHERE id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(true)
    }

    pub async fn create_server(&self, server: &NewServer) -> Result<ServerRecord, StorageError> {
        Ok(sqlx::query_as(
            r#"
            INSERT INTO servers
                (owner_id, name, description, edition, host, port, qq_group, cover_url, review_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, owner_id, name, description, edition, host, port,
                      qq_group, cover_url, review_status, created_at, updated_at,
                      NULL::boolean AS probe_reachable, NULL::text AS probe_edition,
                      NULL::text AS probe_error, NULL::timestamptz AS probe_checked_at
            "#,
        )
        .bind(server.owner_id)
        .bind(&server.name)
        .bind(&server.description)
        .bind(match server.edition {
            ServerEdition::Java => "java",
            ServerEdition::Bedrock => "bedrock",
        })
        .bind(&server.host)
        .bind(server.port)
        .bind(&server.qq_group)
        .bind(&server.cover_url)
        .bind(server.status.as_str())
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn create_server_with_task(
        &self,
        server: &NewServer,
    ) -> Result<ServerRecord, StorageError> {
        let mut tx = self.pool.begin().await?;
        let record: ServerRecord = sqlx::query_as(
            r#"
            INSERT INTO servers
                (owner_id, name, description, edition, host, port, qq_group, cover_url, review_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, owner_id, name, description, edition, host, port,
                      qq_group, cover_url, review_status, created_at, updated_at,
                      NULL::boolean AS probe_reachable, NULL::text AS probe_edition,
                      NULL::text AS probe_error, NULL::timestamptz AS probe_checked_at
            "#,
        )
        .bind(server.owner_id)
        .bind(&server.name)
        .bind(&server.description)
        .bind(match server.edition { ServerEdition::Java => "java", ServerEdition::Bedrock => "bedrock" })
        .bind(&server.host)
        .bind(server.port)
        .bind(&server.qq_group)
        .bind(&server.cover_url)
        .bind(server.status.as_str())
        .fetch_one(&mut *tx)
        .await?;
        let payload = TaskPayload::ProbeMinecraft(ProbeTaskPayload {
            server_id: record.id,
            host: record.host.clone(),
            port: u16::try_from(record.port).map_err(|_| StorageError::InvalidServerPort)?,
            edition: record.edition.clone(),
        });
        let task = TaskInsert::with_payload("probe_minecraft", record.id, &payload)
            .map_err(StorageError::TaskPayload)?;
        sqlx::query("INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts) VALUES ($1, $2, $3, $4, $5)")
            .bind(&task.kind).bind(task.resource_id).bind(&task.idempotency_key).bind(&task.payload).bind(task.attempts)
            .execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(record)
    }

    pub async fn find_server(&self, server_id: Uuid) -> Result<Option<ServerRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT s.id, s.owner_id, s.name, s.description, s.edition, s.host, s.port,
                   s.qq_group, s.cover_url, s.review_status, s.created_at, s.updated_at,
                   p.reachable AS probe_reachable, p.edition AS probe_edition,
                   p.error AS probe_error, p.checked_at AS probe_checked_at
            FROM servers s
            LEFT JOIN server_probe_results p ON p.server_id = s.id
            WHERE s.id = $1
            "#,
        )
        .bind(server_id)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn update_server_owned(
        &self,
        server_id: Uuid,
        server: &NewServer,
    ) -> Result<Option<ServerRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            UPDATE servers
            SET name = $2, description = $3, edition = $4, host = $5, port = $6,
                qq_group = $7, cover_url = $8, updated_at = now()
            WHERE id = $1 AND owner_id = $9
            RETURNING id, owner_id, name, description, edition, host, port,
                      qq_group, cover_url, review_status, created_at, updated_at,
                      NULL::boolean AS probe_reachable, NULL::text AS probe_edition,
                      NULL::text AS probe_error, NULL::timestamptz AS probe_checked_at
            "#,
        )
        .bind(server_id)
        .bind(&server.name)
        .bind(&server.description)
        .bind(match server.edition {
            ServerEdition::Java => "java",
            ServerEdition::Bedrock => "bedrock",
        })
        .bind(&server.host)
        .bind(server.port)
        .bind(&server.qq_group)
        .bind(&server.cover_url)
        .bind(server.owner_id)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn update_server_owned_with_task(
        &self,
        server_id: Uuid,
        server: &NewServer,
    ) -> Result<Option<ServerRecord>, StorageError> {
        let mut tx = self.pool.begin().await?;
        let record: Option<ServerRecord> = sqlx::query_as(
            r#"
            UPDATE servers
            SET name = $2, description = $3, edition = $4, host = $5, port = $6,
                qq_group = $7, cover_url = $8, updated_at = now()
            WHERE id = $1 AND owner_id = $9
            RETURNING id, owner_id, name, description, edition, host, port,
                      qq_group, cover_url, review_status, created_at, updated_at,
                      NULL::boolean AS probe_reachable, NULL::text AS probe_edition,
                      NULL::text AS probe_error, NULL::timestamptz AS probe_checked_at
            "#,
        )
        .bind(server_id)
        .bind(&server.name)
        .bind(&server.description)
        .bind(match server.edition {
            ServerEdition::Java => "java",
            ServerEdition::Bedrock => "bedrock",
        })
        .bind(&server.host)
        .bind(server.port)
        .bind(&server.qq_group)
        .bind(&server.cover_url)
        .bind(server.owner_id)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(record) = record else {
            tx.rollback().await?;
            return Ok(None);
        };
        let payload = TaskPayload::ProbeMinecraft(ProbeTaskPayload {
            server_id: record.id,
            host: record.host.clone(),
            port: u16::try_from(record.port).map_err(|_| StorageError::InvalidServerPort)?,
            edition: record.edition.clone(),
        });
        let task = TaskInsert::with_payload("probe_minecraft", record.id, &payload)?;
        // An edit is a new probe event; a UUID avoids timestamp collision under concurrent edits.
        let task_key = format!("{}:{}", task.idempotency_key, Uuid::new_v4());
        sqlx::query("INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts) VALUES ($1, $2, $3, $4, $5)")
            .bind(&task.kind).bind(task.resource_id).bind(task_key).bind(&task.payload).bind(task.attempts)
            .execute(&mut *tx).await?;
        sqlx::query("DELETE FROM server_probe_results WHERE server_id = $1")
            .bind(record.id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(Some(record))
    }

    pub async fn set_review_status(
        &self,
        server_id: Uuid,
        status: ServerStatus,
    ) -> Result<Option<ServerRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            UPDATE servers SET review_status = $2, updated_at = now()
            WHERE id = $1
            RETURNING id, owner_id, name, description, edition, host, port,
                      qq_group, cover_url, review_status, created_at, updated_at,
                      NULL::boolean AS probe_reachable, NULL::text AS probe_edition,
                      NULL::text AS probe_error, NULL::timestamptz AS probe_checked_at
            "#,
        )
        .bind(server_id)
        .bind(status.as_str())
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn list_approved_servers(&self) -> Result<Vec<ServerRecord>, StorageError> {
        self.list_approved_servers_page(100, 0, None).await
    }

    pub async fn list_approved_servers_page(
        &self,
        limit: i64,
        offset: i64,
        search: Option<&str>,
    ) -> Result<Vec<ServerRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT s.id, s.owner_id, s.name, s.description, s.edition, s.host, s.port,
                   s.qq_group, s.cover_url, s.review_status, s.created_at, s.updated_at,
                   p.reachable AS probe_reachable, p.edition AS probe_edition,
                   p.error AS probe_error, p.checked_at AS probe_checked_at
            FROM servers s
            LEFT JOIN server_probe_results p ON p.server_id = s.id
            WHERE s.review_status = 'APPROVED'
              AND ($3::text IS NULL OR s.name ILIKE '%' || $3 || '%' OR s.description ILIKE '%' || $3 || '%' OR s.host ILIKE '%' || $3 || '%')
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit.clamp(1, 100))
        .bind(offset.max(0))
        .bind(search)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn public_stats(&self) -> Result<PublicStats, StorageError> {
        Ok(sqlx::query_as(
            r#"SELECT
                (SELECT count(*) FROM servers WHERE review_status = 'APPROVED') AS total_servers,
                (SELECT count(*) FROM users WHERE email_verified = TRUE) AS total_users,
                (SELECT count(*) FROM server_probe_results WHERE reachable = TRUE) AS online_nodes"#,
        )
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn checkin_state(&self, user_id: i64) -> Result<CheckinState, StorageError> {
        Ok(sqlx::query_as(
            r#"WITH recent AS (
                SELECT checkin_date, created_at,
                       checkin_date + (row_number() OVER (ORDER BY checkin_date DESC))::int AS grp
                FROM user_checkins WHERE user_id = $1
            ), current_streak AS (
                SELECT count(*)::bigint AS days
                FROM recent
                WHERE grp = (SELECT grp FROM recent WHERE checkin_date IN ((now() AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date - 1) ORDER BY checkin_date DESC LIMIT 1)
            )
            SELECT EXISTS(SELECT 1 FROM user_checkins WHERE user_id = $1 AND checkin_date = (now() AT TIME ZONE 'UTC')::date) AS checked_in_today,
                   COALESCE((SELECT days FROM current_streak), 0) AS streak_days,
                   (SELECT created_at FROM user_checkins WHERE user_id = $1 AND checkin_date = (now() AT TIME ZONE 'UTC')::date) AS checkin_at"#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn checkin_today(&self, user_id: i64) -> Result<(bool, CheckinState), StorageError> {
        let inserted = sqlx::query(
            "INSERT INTO user_checkins (user_id, checkin_date) VALUES ($1, (now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING",
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?
        .rows_affected()
            == 1;
        Ok((inserted, self.checkin_state(user_id).await?))
    }

    pub async fn favorite_state(
        &self,
        user_id: i64,
        server_id: Uuid,
    ) -> Result<bool, StorageError> {
        let approved = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM servers WHERE id = $1 AND review_status = 'APPROVED')",
        )
        .bind(server_id)
        .fetch_one(&self.pool)
        .await?;
        if !approved {
            return Err(StorageError::NotFound);
        }
        Ok(sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM server_favorites WHERE user_id = $1 AND server_id = $2)",
        )
        .bind(user_id)
        .bind(server_id)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn toggle_favorite(
        &self,
        user_id: i64,
        server_id: Uuid,
    ) -> Result<bool, StorageError> {
        let mut transaction = self.pool.begin().await?;
        let approved = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM servers WHERE id = $1 AND review_status = 'APPROVED' FOR UPDATE",
        )
        .bind(server_id)
        .fetch_optional(&mut *transaction)
        .await?;
        if approved.is_none() {
            return Err(StorageError::NotFound);
        }
        let removed =
            sqlx::query("DELETE FROM server_favorites WHERE user_id = $1 AND server_id = $2")
                .bind(user_id)
                .bind(server_id)
                .execute(&mut *transaction)
                .await?
                .rows_affected();
        if removed == 0 {
            sqlx::query("INSERT INTO server_favorites (user_id, server_id) VALUES ($1, $2)")
                .bind(user_id)
                .bind(server_id)
                .execute(&mut *transaction)
                .await?;
        }
        transaction.commit().await?;
        Ok(removed == 0)
    }

    pub async fn list_favorite_servers(
        &self,
        user_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ServerRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT s.id, s.owner_id, s.name, s.description, s.edition, s.host, s.port,
                   s.qq_group, s.cover_url, s.review_status, s.created_at, s.updated_at,
                   p.reachable AS probe_reachable, p.edition AS probe_edition,
                   p.error AS probe_error, p.checked_at AS probe_checked_at
            FROM server_favorites f
            JOIN servers s ON s.id = f.server_id
            LEFT JOIN server_probe_results p ON p.server_id = s.id
            WHERE f.user_id = $1 AND s.review_status = 'APPROVED'
            ORDER BY f.created_at DESC, s.id DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit.clamp(1, 100))
        .bind(offset.max(0))
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn like_state(&self, user_id: i64, server_id: Uuid) -> Result<bool, StorageError> {
        let approved = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM servers WHERE id = $1 AND review_status = 'APPROVED')",
        )
        .bind(server_id)
        .fetch_one(&self.pool)
        .await?;
        if !approved {
            return Err(StorageError::NotFound);
        }
        Ok(sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM server_likes WHERE user_id = $1 AND server_id = $2)",
        )
        .bind(user_id)
        .bind(server_id)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn toggle_like(&self, user_id: i64, server_id: Uuid) -> Result<bool, StorageError> {
        let mut transaction = self.pool.begin().await?;
        let approved = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM servers WHERE id = $1 AND review_status = 'APPROVED' FOR UPDATE",
        )
        .bind(server_id)
        .fetch_optional(&mut *transaction)
        .await?;
        if approved.is_none() {
            return Err(StorageError::NotFound);
        }
        let removed = sqlx::query("DELETE FROM server_likes WHERE user_id = $1 AND server_id = $2")
            .bind(user_id)
            .bind(server_id)
            .execute(&mut *transaction)
            .await?
            .rows_affected();
        if removed == 0 {
            sqlx::query("INSERT INTO server_likes (user_id, server_id) VALUES ($1, $2)")
                .bind(user_id)
                .bind(server_id)
                .execute(&mut *transaction)
                .await?;
        }
        transaction.commit().await?;
        Ok(removed == 0)
    }

    pub async fn list_servers_owned(
        &self,
        owner_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ServerRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            SELECT s.id, s.owner_id, s.name, s.description, s.edition, s.host, s.port,
                   s.qq_group, s.cover_url, s.review_status, s.created_at, s.updated_at,
                   p.reachable AS probe_reachable, p.edition AS probe_edition,
                   p.error AS probe_error, p.checked_at AS probe_checked_at
            FROM servers s
            LEFT JOIN server_probe_results p ON p.server_id = s.id
            WHERE s.owner_id = $1
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(owner_id)
        .bind(limit.clamp(1, 100))
        .bind(offset.max(0))
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn delete_server_owned(
        &self,
        server_id: Uuid,
        owner_id: i64,
    ) -> Result<Option<DeleteServerOutcome>, StorageError> {
        let domain_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM server_domains WHERE server_id = $1 AND owner_id = $2)",
        )
        .bind(server_id)
        .bind(owner_id)
        .fetch_one(&self.pool)
        .await?;
        if !domain_exists {
            let result = sqlx::query("DELETE FROM servers WHERE id = $1 AND owner_id = $2")
                .bind(server_id)
                .bind(owner_id)
                .execute(&self.pool)
                .await?;
            return Ok((result.rows_affected() == 1).then_some(DeleteServerOutcome::Deleted));
        }
        sqlx::query("UPDATE server_domains SET delete_after_revoke = TRUE WHERE server_id = $1 AND owner_id = $2")
            .bind(server_id).bind(owner_id).execute(&self.pool).await?;
        let revoked = self.revoke_server_domain_owned(server_id, owner_id).await?;
        if revoked {
            return Ok(Some(DeleteServerOutcome::PendingDnsRevoke));
        }
        Ok(sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM server_domains WHERE server_id = $1 AND owner_id = $2 AND delete_after_revoke = TRUE)")
            .bind(server_id).bind(owner_id).fetch_one(&self.pool).await?
            .then_some(DeleteServerOutcome::PendingDnsRevoke))
    }

    /// Returns false when a newer server address superseded this probe task.
    pub async fn record_probe_result_if_current(
        &self,
        server_id: Uuid,
        host: &str,
        port: u16,
        reachable: bool,
        edition: &str,
        error: Option<&str>,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query(
            r#"
            INSERT INTO server_probe_results (server_id, reachable, edition, error)
            SELECT $1, $4, $5, $6
            WHERE EXISTS (
                SELECT 1 FROM servers
                WHERE id = $1 AND host = $2 AND port = $3 AND edition = $5
            )
            ON CONFLICT (server_id) DO UPDATE
            SET reachable = EXCLUDED.reachable, edition = EXCLUDED.edition,
                error = EXCLUDED.error, checked_at = now()
            WHERE EXISTS (
                SELECT 1 FROM servers
                WHERE id = EXCLUDED.server_id AND host = $2 AND port = $3 AND edition = $5
            )
            "#,
        )
        .bind(server_id)
        .bind(host)
        .bind(i32::from(port))
        .bind(reachable)
        .bind(edition)
        .bind(error)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn enqueue_task(&self, task: &TaskInsert) -> Result<TaskRecord, StorageError> {
        Ok(sqlx::query_as(
            r#"
            INSERT INTO tasks (kind, resource_id, idempotency_key, payload, attempts)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (idempotency_key) DO UPDATE
                SET idempotency_key = EXCLUDED.idempotency_key
            RETURNING id, kind, resource_id, idempotency_key, payload, status, attempts,
                      next_attempt_at, last_error
            "#,
        )
        .bind(&task.kind)
        .bind(task.resource_id)
        .bind(&task.idempotency_key)
        .bind(&task.payload)
        .bind(task.attempts)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn claim_next_task(
        &self,
        max_attempts: i32,
    ) -> Result<Option<TaskRecord>, StorageError> {
        Ok(sqlx::query_as(
            r#"
            WITH next_task AS (
                SELECT id FROM tasks
                WHERE status IN ('PENDING', 'FAILED')
                  AND next_attempt_at <= now()
                  AND attempts < $1
                ORDER BY next_attempt_at, created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE tasks
            SET status = 'RUNNING', attempts = attempts + 1, updated_at = now()
            WHERE id IN (SELECT id FROM next_task)
            RETURNING id, kind, resource_id, idempotency_key, payload, status, attempts,
                      next_attempt_at, last_error
            "#,
        )
        .bind(max_attempts)
        .fetch_optional(&self.pool)
        .await?)
    }

    /// Releases work abandoned by a crashed worker so it can be retried.
    pub async fn reclaim_stale_tasks(&self, lease_seconds: i64) -> Result<u64, StorageError> {
        let result = sqlx::query(
            "UPDATE tasks SET status = 'FAILED', last_error = 'worker lease expired', next_attempt_at = now(), updated_at = now() WHERE status = 'RUNNING' AND updated_at < now() - ($1 * interval '1 second')",
        )
        .bind(lease_seconds.max(30))
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    pub async fn complete_task(&self, task_id: Uuid) -> Result<bool, StorageError> {
        let result = sqlx::query(
            "UPDATE tasks SET status = 'SUCCEEDED', last_error = NULL, updated_at = now() WHERE id = $1 AND status = 'RUNNING'",
        )
        .bind(task_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn complete_task_with_payload(
        &self,
        task_id: Uuid,
        payload: &Value,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query(
            "UPDATE tasks SET status = 'SUCCEEDED', payload = $2, last_error = NULL, updated_at = now() WHERE id = $1 AND status = 'RUNNING'",
        )
        .bind(task_id)
        .bind(payload)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn fail_task(
        &self,
        task_id: Uuid,
        message: &str,
        next_attempt_at: DateTime<Utc>,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query(
            "UPDATE tasks SET status = 'FAILED', last_error = $2, next_attempt_at = $3, updated_at = now() WHERE id = $1 AND status = 'RUNNING'",
        )
        .bind(task_id)
        .bind(message)
        .bind(next_attempt_at)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }
}
