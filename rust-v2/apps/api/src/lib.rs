use axum::{
    Router,
    extract::{
        DefaultBodyLimit, Extension, Json, Path, Query, Request, State, rejection::JsonRejection,
    },
    http::{
        HeaderMap, Method, StatusCode,
        header::{HeaderValue, SET_COOKIE},
    },
    middleware::{self, Next},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post, put},
};
use base64::Engine;
use chrono::{Duration, Utc};
use qianfu_auth::{PasswordHash, SessionToken, VerificationCode, normalize_email};
use qianfu_core::{
    ApiError, AppConfig, ErrorCode, NormalizedServerPublish, PkceVerifier, ResponseEnvelope,
    ServerPublishInput, compose_domain,
};
use qianfu_storage::{
    DeleteServerOutcome, DnsSuffixRecord, NewServer, PgStorage, ServerDomainRecord, ServerRecord,
    ServerStatus, StorageError, TaskInsert, UserRecord,
};
use serde::Deserialize;
use serde::Serialize;
use sha2::Digest;
use std::time::{Duration as StdDuration, Instant};
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicU64, Ordering},
    },
};
use uuid::Uuid;

#[derive(Debug, Serialize)]
struct HealthData {
    status: &'static str,
    service: &'static str,
}

#[derive(Debug, Serialize)]
struct PublicStatsView {
    #[serde(rename = "totalServers")]
    total_servers: i64,
    #[serde(rename = "totalUsers")]
    total_users: i64,
    #[serde(rename = "onlineNodes")]
    online_nodes: i64,
}

#[derive(Debug, Serialize)]
struct CheckinView {
    #[serde(rename = "checkedInToday")]
    checked_in_today: bool,
    #[serde(rename = "streakDays")]
    streak_days: i64,
    #[serde(rename = "rewardXp")]
    reward_xp: i64,
    #[serde(rename = "alreadyCheckedIn", skip_serializing_if = "Option::is_none")]
    already_checked_in: Option<bool>,
    #[serde(rename = "gainedXp", skip_serializing_if = "Option::is_none")]
    gained_xp: Option<i64>,
    #[serde(rename = "checkinAt")]
    checkin_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Clone)]
pub struct ApiState {
    pub storage: Arc<PgStorage>,
    pub config: Option<AppConfig>,
}

#[derive(Deserialize)]
struct GithubCallback {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct OAuthStatus {
    providers: OAuthProviders,
}
#[derive(Serialize)]
struct OAuthProviders {
    github: GithubStatus,
}
#[derive(Serialize)]
struct GithubStatus {
    #[serde(rename = "backendEnabled")]
    backend_enabled: bool,
    #[serde(rename = "loginUrl")]
    login_url: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
struct DomainRequest {
    suffix_id: Uuid,
    prefix: String,
}

#[derive(Debug, Deserialize)]
struct DnsSuffixRequest {
    suffix: String,
    provider: String,
    zone: String,
    ttl: Option<i32>,
    quota_per_user: Option<i32>,
    reserved_prefixes: Option<Vec<String>>,
}

#[derive(Serialize)]
struct DnsSuffixView {
    id: Uuid,
    suffix: String,
    provider: String,
    ttl: i32,
}

#[derive(Serialize)]
struct ServerDomainView {
    domain: String,
    application_status: String,
    dns_status: String,
    target: String,
    port: i32,
}

#[derive(Serialize)]
struct DeleteServerView {
    status: &'static str,
}

#[derive(Serialize)]
struct FavoriteView {
    favorited: bool,
}

#[derive(Serialize)]
struct LikeView {
    liked: bool,
}

impl From<DnsSuffixRecord> for DnsSuffixView {
    fn from(value: DnsSuffixRecord) -> Self {
        Self {
            id: value.id,
            suffix: value.suffix,
            provider: value.provider,
            ttl: value.ttl,
        }
    }
}
impl From<ServerDomainRecord> for ServerDomainView {
    fn from(value: ServerDomainRecord) -> Self {
        Self {
            domain: value.domain,
            application_status: value.application_status,
            dns_status: value.dns_status,
            target: value.target,
            port: value.port,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    #[serde(alias = "identifier")]
    email: String,
    password: String,
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    #[serde(alias = "identifier")]
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct VerifyEmailRequest {
    email: String,
    #[serde(alias = "code")]
    token: String,
}

#[derive(Debug, Deserialize)]
struct SendCodeRequest {
    email: String,
}

#[derive(Debug, Deserialize)]
struct ReviewRequest {
    approved: bool,
}

#[derive(Debug, Deserialize)]
struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
}

#[derive(Debug, Deserialize)]
struct UpdateProfileRequest {
    display_name: Option<String>,
    username: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PasswordResetRequest {
    email: String,
}

#[derive(Debug, Deserialize)]
struct CompletePasswordResetRequest {
    email: String,
    token: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct ServerListQuery {
    limit: Option<i64>,
    offset: Option<i64>,
    search: Option<String>,
    platform: Option<String>,
    category: Option<String>,
    version: Option<String>,
    online: Option<bool>,
    #[serde(rename = "sortBy")]
    sort_by: Option<String>,
}

#[derive(Debug, Serialize)]
struct AuthUser {
    id: i64,
    email: String,
    display_name: Option<String>,
    role: String,
    email_verified: bool,
}

#[derive(Debug, Serialize)]
struct AuthResult {
    user: AuthUser,
    #[serde(rename = "pendingVerification")]
    pending_verification: bool,
}

const LOGIN_FAILURE_LIMIT: u32 = 5;
const LOGIN_FAILURE_WINDOW: StdDuration = StdDuration::from_secs(60);
static LOGIN_FAILURES: OnceLock<Mutex<HashMap<String, (u32, Instant)>>> = OnceLock::new();
static PASSWORD_RESET_REQUESTS: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
static EMAIL_CODE_REQUESTS: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static DUMMY_PASSWORD_HASH: OnceLock<PasswordHash> = OnceLock::new();

fn verify_dummy_password(password: &str) {
    let hash = DUMMY_PASSWORD_HASH.get_or_init(|| {
        PasswordHash::derive("qianfu-dummy-password")
            .expect("static dummy password must satisfy password policy")
    });
    let _ = hash.verify(password);
}

fn login_is_limited(email: &str) -> bool {
    let now = Instant::now();
    let mut failures = LOGIN_FAILURES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .expect("login limiter mutex poisoned");
    match failures.get(email) {
        Some((count, started)) if now.duration_since(*started) < LOGIN_FAILURE_WINDOW => {
            *count >= LOGIN_FAILURE_LIMIT
        }
        _ => {
            failures.remove(email);
            false
        }
    }
}

fn record_login_failure(email: &str) {
    let now = Instant::now();
    let mut failures = LOGIN_FAILURES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .expect("login limiter mutex poisoned");
    failures.retain(|_, (_, started)| now.duration_since(*started) < LOGIN_FAILURE_WINDOW);
    if failures.len() >= 10_000 && !failures.contains_key(email) {
        return;
    }
    let entry = failures.entry(email.to_owned()).or_insert((0, now));
    if now.duration_since(entry.1) >= LOGIN_FAILURE_WINDOW {
        *entry = (0, now);
    }
    entry.0 = entry.0.saturating_add(1);
}

fn password_reset_is_limited(email: &str) -> bool {
    const WINDOW: StdDuration = StdDuration::from_secs(60);
    let now = Instant::now();
    let mut requests = PASSWORD_RESET_REQUESTS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .expect("password reset limiter mutex poisoned");
    requests.retain(|_, started| now.duration_since(*started) < WINDOW);
    if requests.contains_key(email) {
        return true;
    }
    if requests.len() >= 10_000 {
        return true;
    }
    requests.insert(email.to_owned(), now);
    false
}

fn email_code_is_limited(email: &str) -> bool {
    const WINDOW: StdDuration = StdDuration::from_secs(60);
    let now = Instant::now();
    let mut requests = EMAIL_CODE_REQUESTS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .expect("email code limiter mutex poisoned");
    requests.retain(|_, started| now.duration_since(*started) < WINDOW);
    if requests.contains_key(email) || requests.len() >= 10_000 {
        return true;
    }
    requests.insert(email.to_owned(), now);
    false
}

fn clear_login_failures(email: &str) {
    if let Some(lock) = LOGIN_FAILURES.get() {
        lock.lock()
            .expect("login limiter mutex poisoned")
            .remove(email);
    }
}

#[derive(Debug, Serialize)]
struct ServerView {
    id: Uuid,
    name: String,
    description: String,
    edition: String,
    category: Option<String>,
    version: Option<String>,
    host: String,
    port: i32,
    qq_group: Option<String>,
    cover_url: Option<String>,
    review_status: String,
    created_at: chrono::DateTime<Utc>,
    probe_reachable: Option<bool>,
    probe_edition: Option<String>,
    probe_checked_at: Option<chrono::DateTime<Utc>>,
}

impl From<ServerRecord> for ServerView {
    fn from(server: ServerRecord) -> Self {
        Self {
            id: server.id,
            name: server.name,
            description: server.description,
            edition: server.edition,
            category: server.category,
            version: server.version,
            host: server.host,
            port: server.port,
            qq_group: server.qq_group,
            cover_url: server.cover_url,
            review_status: server.review_status,
            created_at: server.created_at,
            probe_reachable: server.probe_reachable,
            probe_edition: server.probe_edition,
            probe_checked_at: server.probe_checked_at,
        }
    }
}

impl From<UserRecord> for AuthUser {
    fn from(user: UserRecord) -> Self {
        Self {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            email_verified: user.email_verified,
        }
    }
}

async fn request_id_middleware(mut request: Request, next: Next) -> Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| Uuid::parse_str(value).ok())
        .unwrap_or_else(Uuid::new_v4);

    request.extensions_mut().insert(request_id);
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    if matches!(
        request.method().as_str(),
        "POST" | "PUT" | "PATCH" | "DELETE"
    ) && let Some(origin) = request
        .headers()
        .get("origin")
        .and_then(|value| value.to_str().ok())
        && !is_same_origin(&request, origin)
        && !is_configured_origin(origin)
    {
        return api_error(
            request_id,
            StatusCode::FORBIDDEN,
            ErrorCode::Forbidden,
            "cross-site request blocked".to_owned(),
        );
    }
    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&request_id.to_string()) {
        response.headers_mut().insert("x-request-id", value);
    }
    response
}

async fn cors_middleware(request: Request, next: Next) -> Response {
    let origin = request
        .headers()
        .get("origin")
        .and_then(|value| value.to_str().ok())
        .filter(|origin| is_configured_origin(origin))
        .map(str::to_owned);
    if request.method() == Method::OPTIONS {
        let Some(origin) = origin else {
            return StatusCode::FORBIDDEN.into_response();
        };
        let mut response = StatusCode::NO_CONTENT.into_response();
        add_cors_headers(response.headers_mut(), &origin);
        return response;
    }

    let mut response = next.run(request).await;
    if let Some(origin) = origin {
        add_cors_headers(response.headers_mut(), &origin);
    }
    response
}

fn configured_origins() -> Vec<String> {
    std::env::var("QF_ALLOWED_ORIGINS")
        .ok()
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|origin| is_valid_origin(origin))
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn is_valid_origin(origin: &str) -> bool {
    let Ok(url) = url::Url::parse(origin) else {
        return false;
    };
    matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some()
        && url.path() == "/"
        && url.query().is_none()
        && url.fragment().is_none()
}

fn is_configured_origin(origin: &str) -> bool {
    is_valid_origin(origin) && configured_origins().iter().any(|item| item == origin)
}

fn is_same_origin(request: &Request, origin: &str) -> bool {
    let host = request
        .headers()
        .get("host")
        .and_then(|value| value.to_str().ok());
    let Ok(parsed) = url::Url::parse(origin) else {
        return false;
    };
    let origin_host = parsed.host_str().map(|host| match parsed.port() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_owned(),
    });
    host.is_some_and(|host| origin_host.as_deref() == Some(host))
        && matches!(parsed.scheme(), "http" | "https")
        && parsed.path() == "/"
        && parsed.query().is_none()
        && parsed.fragment().is_none()
}

fn add_cors_headers(headers: &mut HeaderMap, origin: &str) {
    let Ok(origin) = HeaderValue::from_str(origin) else {
        return;
    };
    headers.insert("access-control-allow-origin", origin);
    headers.insert(
        "access-control-allow-credentials",
        HeaderValue::from_static("true"),
    );
    headers.insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, PATCH, DELETE, OPTIONS"),
    );
    headers.insert(
        "access-control-allow-headers",
        HeaderValue::from_static("authorization, content-type, x-csrf-token, x-request-id"),
    );
    headers.insert("vary", HeaderValue::from_static("Origin"));
}

async fn security_headers_middleware(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert("cache-control", HeaderValue::from_static("no-store"));
    headers.insert(
        "content-security-policy",
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"),
    );
    if cookie_is_secure() {
        headers.insert(
            "strict-transport-security",
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        );
    }
    response
}

async fn health(Extension(request_id): Extension<Uuid>) -> Json<ResponseEnvelope<HealthData>> {
    Json(ResponseEnvelope::success(
        request_id,
        HealthData {
            status: "healthy",
            service: "qianfu-api-rs",
        },
    ))
}

async fn metrics(
    headers: HeaderMap,
) -> Result<([(axum::http::HeaderName, &'static str); 1], String), StatusCode> {
    let expected = std::env::var("QF_METRICS_TOKEN").map_err(|_| StatusCode::NOT_FOUND)?;
    let provided = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    if provided != Some(expected.as_str()) {
        return Err(StatusCode::NOT_FOUND);
    }
    let body = format!(
        "# TYPE qianfu_api_requests_total counter\nqianfu_api_requests_total {}\n",
        REQUEST_COUNT.load(Ordering::Relaxed)
    );
    Ok((
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        body,
    ))
}

async fn readiness(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
) -> Response {
    match state.storage.ping().await {
        Ok(()) => Json(ResponseEnvelope::success(
            request_id,
            HealthData {
                status: "ready",
                service: "qianfu-api-rs",
            },
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn public_stats(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
) -> Response {
    match state.storage.public_stats().await {
        Ok(stats) => Json(ResponseEnvelope::success(
            request_id,
            PublicStatsView {
                total_servers: stats.total_servers,
                total_users: stats.total_users,
                online_nodes: stats.online_nodes,
            },
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn checkin_status(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.checkin_state(user.id).await {
        Ok(value) => Json(ResponseEnvelope::success(
            request_id,
            CheckinView {
                checked_in_today: value.checked_in_today,
                streak_days: value.streak_days,
                reward_xp: 0,
                already_checked_in: None,
                gained_xp: None,
                checkin_at: value.checkin_at,
            },
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn checkin(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.checkin_today(user.id).await {
        Ok((inserted, value)) => Json(ResponseEnvelope::success(
            request_id,
            CheckinView {
                checked_in_today: true,
                streak_days: value.streak_days,
                reward_xp: 0,
                already_checked_in: Some(!inserted),
                gained_xp: Some(0),
                checkin_at: value.checkin_at,
            },
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn validate_publish(
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<ServerPublishInput>, JsonRejection>,
) -> (StatusCode, Json<ResponseEnvelope<NormalizedServerPublish>>) {
    let Json(input) = match payload {
        Ok(payload) => payload,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ResponseEnvelope::error(
                    request_id,
                    ApiError::new(ErrorCode::ValidationError, "invalid JSON request"),
                )),
            );
        }
    };
    match input.normalize() {
        Ok(data) => (
            StatusCode::OK,
            Json(ResponseEnvelope::success(request_id, data)),
        ),
        Err(error) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ResponseEnvelope::error(
                request_id,
                ApiError::new(ErrorCode::ValidationError, error.to_string()),
            )),
        ),
    }
}

async fn register(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<RegisterRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let email = match normalize_email(&payload.email) {
        Ok(email) => email,
        Err(error) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                error.to_string(),
            );
        }
    };
    let password = match PasswordHash::derive(&payload.password) {
        Ok(password) => password,
        Err(error) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                error.to_string(),
            );
        }
    };
    let display_name = payload
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let verification = VerificationCode::generate();
    let mail = qianfu_core::TaskPayload::SendMail(qianfu_core::MailTaskPayload {
        account_id: Uuid::nil(),
        to: vec![email.clone()],
        subject: "千服邮箱验证码".to_owned(),
        text: format!(
            "您的邮箱验证码为：{}，15 分钟内有效。",
            verification.expose()
        ),
    });
    let task = match TaskInsert::with_payload("send_mail", Uuid::new_v4(), &mail) {
        Ok(task) => task,
        Err(error) => {
            return api_error(
                request_id,
                StatusCode::INTERNAL_SERVER_ERROR,
                ErrorCode::InternalError,
                error.to_string(),
            );
        }
    };
    let user = match state
        .storage
        .register_user_with_verification(
            &email,
            password.as_str(),
            display_name,
            &verification_digest(&state.config, &verification),
            Utc::now() + Duration::minutes(15),
            &task,
        )
        .await
    {
        Ok(user) => user,
        Err(error) => return storage_error(request_id, error),
    };
    Json(ResponseEnvelope::success(
        request_id,
        AuthResult {
            user: AuthUser::from(user),
            pending_verification: true,
        },
    ))
    .into_response()
}

async fn verify_email(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<VerifyEmailRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let email = match normalize_email(&payload.email) {
        Ok(email) => email,
        Err(_) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                "invalid email address".to_owned(),
            );
        }
    };
    let token = match VerificationCode::parse(&payload.token) {
        Ok(token) => token,
        Err(_) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                "invalid verification token".to_owned(),
            );
        }
    };
    match state
        .storage
        .consume_email_verification(&email, &verification_digest(&state.config, &token))
        .await
    {
        Ok(true) => match state.storage.find_user_by_email(&email).await {
            Ok(Some(user)) => issue_session(state, request_id, user, false).await,
            Ok(None) => unauthorized(request_id),
            Err(error) => storage_error(request_id, error),
        },
        Ok(false) => api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "verification token is invalid or expired".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn send_code(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<SendCodeRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let email = match normalize_email(&payload.email) {
        Ok(email) => email,
        Err(_) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                "invalid email address".to_owned(),
            );
        }
    };
    if email_code_is_limited(&email) {
        return Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"sent": true}),
        ))
        .into_response();
    }
    let user = match state.storage.find_user_by_email(&email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Json(ResponseEnvelope::success(
                request_id,
                serde_json::json!({"sent": true}),
            ))
            .into_response();
        }
        Err(error) => return storage_error(request_id, error),
    };
    if user.email_verified {
        return Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"sent": true}),
        ))
        .into_response();
    }
    let verification = VerificationCode::generate();
    match state.storage.verification_sent_recently(user.id, 60).await {
        // Keep the cooldown internal so this endpoint cannot enumerate accounts.
        Ok(true) => {
            return Json(ResponseEnvelope::success(
                request_id,
                serde_json::json!({"sent": true}),
            ))
            .into_response();
        }
        Ok(false) => {}
        Err(error) => return storage_error(request_id, error),
    }
    let mail = qianfu_core::TaskPayload::SendMail(qianfu_core::MailTaskPayload {
        account_id: Uuid::nil(),
        to: vec![email],
        subject: "千服邮箱验证码".to_owned(),
        text: format!(
            "您的邮箱验证码为：{}，15 分钟内有效。",
            verification.expose()
        ),
    });
    let task = match TaskInsert::with_payload("send_mail", Uuid::new_v4(), &mail) {
        Ok(task) => task,
        Err(error) => {
            return api_error(
                request_id,
                StatusCode::INTERNAL_SERVER_ERROR,
                ErrorCode::InternalError,
                error.to_string(),
            );
        }
    };
    match state
        .storage
        .create_email_verification_with_task(
            user.id,
            &verification_digest(&state.config, &verification),
            Utc::now() + Duration::minutes(15),
            &task,
        )
        .await
    {
        Ok(()) => Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"sent": true}),
        ))
        .into_response(),
        Err(StorageError::Conflict) => Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"sent": true}),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn request_password_reset(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<PasswordResetRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(value) => value,
        Err(_) => return invalid_json(request_id),
    };
    let Ok(email) = normalize_email(&payload.email) else {
        return Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"sent": true}),
        ))
        .into_response();
    };
    if password_reset_is_limited(&email) {
        return Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"sent": true}),
        ))
        .into_response();
    }
    let user = match state.storage.find_user_by_email(&email).await {
        Ok(value) => value,
        Err(error) => return storage_error(request_id, error),
    };
    if let Some(user) = user {
        let token = VerificationCode::generate();
        let mail = qianfu_core::TaskPayload::SendMail(qianfu_core::MailTaskPayload {
            account_id: Uuid::nil(),
            to: vec![email.clone()],
            subject: "千服密码重置".to_owned(),
            text: format!("密码重置令牌：{}，15 分钟内有效。", token.expose()),
        });
        let task = match TaskInsert::with_payload("send_mail", Uuid::new_v4(), &mail) {
            Ok(task) => task,
            Err(error) => {
                return api_error(
                    request_id,
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorCode::InternalError,
                    error.to_string(),
                );
            }
        };
        match state
            .storage
            .create_password_reset(
                user.id,
                &verification_digest(&state.config, &token),
                Utc::now() + Duration::minutes(15),
                &task,
            )
            .await
        {
            // Keep cooldown behavior without exposing whether an account exists.
            Ok(()) | Err(StorageError::Conflict) => {}
            Err(error) => return storage_error(request_id, error),
        }
    }
    Json(ResponseEnvelope::success(
        request_id,
        serde_json::json!({"sent": true}),
    ))
    .into_response()
}

async fn complete_password_reset(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<CompletePasswordResetRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(value) => value,
        Err(_) => return invalid_json(request_id),
    };
    let Ok(email) = normalize_email(&payload.email) else {
        return unauthorized(request_id);
    };
    let Ok(token) = VerificationCode::parse(&payload.token) else {
        return unauthorized(request_id);
    };
    let Some(user) = (match state.storage.find_user_by_email(&email).await {
        Ok(value) => value,
        Err(error) => return storage_error(request_id, error),
    }) else {
        return unauthorized(request_id);
    };
    let hash = match PasswordHash::derive(&payload.password) {
        Ok(value) => value,
        Err(error) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                error.to_string(),
            );
        }
    };
    match state
        .storage
        .reset_password_with_token(
            user.id,
            &verification_digest(&state.config, &token),
            hash.as_str(),
        )
        .await
    {
        Ok(true) => Json(ResponseEnvelope::success(
            request_id,
            serde_json::json!({"reset": true}),
        ))
        .into_response(),
        Ok(false) => {
            if let Err(error) = state
                .storage
                .record_password_reset_failure(user.id, &verification_digest(&state.config, &token))
                .await
            {
                return storage_error(request_id, error);
            }
            unauthorized(request_id)
        }
        Err(error) => storage_error(request_id, error),
    }
}

async fn login(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    payload: Result<Json<LoginRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let email = match normalize_email(&payload.email) {
        Ok(email) => email,
        Err(_) => return unauthorized(request_id),
    };
    if login_is_limited(&email) {
        return api_error(
            request_id,
            StatusCode::TOO_MANY_REQUESTS,
            ErrorCode::Conflict,
            "too many login attempts; try again later".to_owned(),
        );
    }
    let user = match state.storage.find_user_by_email(&email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            verify_dummy_password(&payload.password);
            record_login_failure(&email);
            return unauthorized(request_id);
        }
        Err(error) => return storage_error(request_id, error),
    };
    if !user.password_hash.as_deref().is_some_and(|hash| {
        PasswordHash::from_storage(hash).is_some_and(|hash| hash.verify(&payload.password))
    }) {
        record_login_failure(&email);
        return unauthorized(request_id);
    }
    if !user.email_verified {
        return api_error(
            request_id,
            StatusCode::FORBIDDEN,
            ErrorCode::EmailNotVerified,
            "email verification is required".to_owned(),
        );
    }
    clear_login_failures(&email);
    issue_session(state, request_id, user, false).await
}

async fn me(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
) -> Response {
    let token = match session_from_headers(&headers) {
        Some(token) => token,
        None => return unauthorized(request_id),
    };
    let session = match state
        .storage
        .find_active_session(&session_digest(&state.config, &token))
        .await
    {
        Ok(Some(session)) => session,
        Ok(None) => return unauthorized(request_id),
        Err(error) => return storage_error(request_id, error),
    };
    let user = match state.storage.find_user_by_id(session.user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => return unauthorized(request_id),
        Err(error) => return storage_error(request_id, error),
    };
    Json(ResponseEnvelope::success(request_id, AuthUser::from(user))).into_response()
}

async fn change_password(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    payload: Result<Json<ChangePasswordRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(hash) = user
        .password_hash
        .as_deref()
        .and_then(PasswordHash::from_storage)
    else {
        return api_error(
            request_id,
            StatusCode::CONFLICT,
            ErrorCode::Conflict,
            "该账号未设置密码".to_owned(),
        );
    };
    if !hash.verify(&payload.current_password) {
        return unauthorized(request_id);
    }
    let new_hash = match PasswordHash::derive(&payload.new_password) {
        Ok(hash) => hash,
        Err(error) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                error.to_string(),
            );
        }
    };
    match state
        .storage
        .update_password_and_revoke_sessions(user.id, new_hash.as_str())
        .await
    {
        Ok(true) => issue_session(state, request_id, user, false).await,
        Ok(false) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "用户不存在".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn update_profile(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    payload: Result<Json<UpdateProfileRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let name = payload
        .display_name
        .or(payload.username)
        .unwrap_or_default()
        .trim()
        .to_owned();
    if name.chars().count() > 50 {
        return api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "显示名称最多 50 个字符".to_owned(),
        );
    }
    match state
        .storage
        .update_display_name(user.id, (!name.is_empty()).then_some(name.as_str()))
        .await
    {
        Ok(Some(updated)) => Json(ResponseEnvelope::success(
            request_id,
            AuthUser::from(updated),
        ))
        .into_response(),
        Ok(None) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "用户不存在".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn logout(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
) -> Response {
    if let Some(token) = session_from_headers(&headers) {
        match state
            .storage
            .find_active_session(&session_digest(&state.config, &token))
            .await
        {
            Ok(Some(session)) => {
                if let Err(error) = state.storage.revoke_session(session.id).await {
                    return storage_error(request_id, error);
                }
            }
            Ok(None) => {}
            Err(error) => return storage_error(request_id, error),
        }
    }
    let mut response = Json(ResponseEnvelope::success(request_id, ())).into_response();
    let cookie = session_cookie("", 0);
    if let Ok(cookie) = HeaderValue::from_str(&cookie) {
        response.headers_mut().insert(SET_COOKIE, cookie);
    }
    response
}

async fn create_server(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    payload: Result<Json<ServerPublishInput>, JsonRejection>,
) -> Response {
    let Json(input) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let server = match normalized_server(user.id, input) {
        Ok(server) => server,
        Err(response) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                response,
            );
        }
    };
    match state.storage.create_server_with_task(&server).await {
        Ok(server) => Json(ResponseEnvelope::success(
            request_id,
            ServerView::from(server),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn update_server(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
    payload: Result<Json<ServerPublishInput>, JsonRejection>,
) -> Response {
    let Json(input) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let server = match normalized_server(user.id, input) {
        Ok(server) => server,
        Err(response) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                response,
            );
        }
    };
    match state
        .storage
        .update_server_owned_with_task(server_id, &server)
        .await
    {
        Ok(Some(server)) => Json(ResponseEnvelope::success(
            request_id,
            ServerView::from(server),
        ))
        .into_response(),
        Ok(None) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "server not found or not owned by current user".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn delete_server(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.delete_server_owned(server_id, user.id).await {
        Ok(Some(DeleteServerOutcome::Deleted)) => Json(ResponseEnvelope::success(
            request_id,
            DeleteServerView { status: "DELETED" },
        ))
        .into_response(),
        Ok(Some(DeleteServerOutcome::PendingDnsRevoke)) => (
            StatusCode::ACCEPTED,
            Json(ResponseEnvelope::success(
                request_id,
                DeleteServerView {
                    status: "PENDING_DNS_REVOKE",
                },
            )),
        )
            .into_response(),
        Ok(None) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "server not found or not owned by current user".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn list_dns_suffixes(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
) -> Response {
    match state.storage.list_dns_suffixes().await {
        Ok(suffixes) => Json(ResponseEnvelope::success(
            request_id,
            suffixes
                .into_iter()
                .map(DnsSuffixView::from)
                .collect::<Vec<_>>(),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn request_server_domain(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
    payload: Result<Json<DomainRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let server = match state.storage.find_server(server_id).await {
        Ok(Some(server)) if server.owner_id == user.id => server,
        Ok(_) => {
            return api_error(
                request_id,
                StatusCode::NOT_FOUND,
                ErrorCode::NotFound,
                "server not found".to_owned(),
            );
        }
        Err(error) => return storage_error(request_id, error),
    };
    match state
        .storage
        .request_server_domain(
            server_id,
            user.id,
            payload.suffix_id,
            &payload.prefix,
            &server.host,
            server.port,
        )
        .await
    {
        Ok(domain) => Json(ResponseEnvelope::success(
            request_id,
            ServerDomainView::from(domain),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn get_server_domain(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state
        .storage
        .find_server_domain_owned(server_id, user.id)
        .await
    {
        Ok(Some(domain)) => Json(ResponseEnvelope::success(
            request_id,
            ServerDomainView::from(domain),
        ))
        .into_response(),
        Ok(None) => Json(ResponseEnvelope::success(
            request_id,
            Option::<ServerDomainView>::None,
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn revoke_server_domain(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state
        .storage
        .revoke_server_domain_owned(server_id, user.id)
        .await
    {
        Ok(true) => Json(ResponseEnvelope::success(request_id, ())).into_response(),
        Ok(false) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "domain binding not found".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn create_dns_suffix(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    payload: Result<Json<DnsSuffixRequest>, JsonRejection>,
) -> Response {
    let Json(payload) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) if user.role == "ADMIN" => user,
        Ok(_) => {
            return api_error(
                request_id,
                StatusCode::FORBIDDEN,
                ErrorCode::Forbidden,
                "administrator access required".to_owned(),
            );
        }
        Err(response) => return response,
    };
    let _ = user;
    let provider = payload.provider.trim().to_ascii_uppercase();
    let suffix = payload.suffix.trim().trim_matches('.').to_ascii_lowercase();
    let zone = payload.zone.trim().trim_matches('.').to_ascii_lowercase();
    let reserved_prefixes = payload.reserved_prefixes.unwrap_or_default();
    let valid_suffix = compose_domain("dns", &suffix, &[]).is_ok();
    let valid_zone = compose_domain("dns", &zone, &[]).is_ok();
    let zone_owns_suffix = suffix == zone
        || suffix
            .strip_suffix(&zone)
            .is_some_and(|prefix| prefix.ends_with('.'));
    let valid_reserved_prefixes = reserved_prefixes.len() <= 100
        && reserved_prefixes
            .iter()
            .all(|prefix| compose_domain(prefix, "example.com", &[]).is_ok());
    if !matches!(provider.as_str(), "CLOUDFLARE" | "ALIYUN")
        || !valid_suffix
        || !valid_zone
        || !zone_owns_suffix
        || !valid_reserved_prefixes
        || payload.ttl.unwrap_or(300) < 60
        || payload.ttl.unwrap_or(300) > 86_400
        || payload.quota_per_user.unwrap_or(1) < 1
        || payload.quota_per_user.unwrap_or(1) > 20
    {
        return api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "DNS suffix configuration is invalid".to_owned(),
        );
    }
    let reserved = serde_json::json!(reserved_prefixes);
    match state
        .storage
        .create_dns_suffix(
            &suffix,
            &provider,
            &zone,
            payload.ttl.unwrap_or(300),
            payload.quota_per_user.unwrap_or(1),
            &reserved,
        )
        .await
    {
        Ok(suffix) => Json(ResponseEnvelope::success(
            request_id,
            DnsSuffixView::from(suffix),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn approve_server_domain(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) if user.role == "ADMIN" => user,
        Ok(_) => {
            return api_error(
                request_id,
                StatusCode::FORBIDDEN,
                ErrorCode::Forbidden,
                "administrator access required".to_owned(),
            );
        }
        Err(response) => return response,
    };
    let _ = user;
    match state.storage.approve_server_domain(server_id).await {
        Ok(Some(domain)) => Json(ResponseEnvelope::success(
            request_id,
            ServerDomainView::from(domain),
        ))
        .into_response(),
        Ok(None) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "pending domain binding not found".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn get_server(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    match state.storage.find_server(server_id).await {
        Ok(Some(server)) if server.review_status == "APPROVED" => Json(ResponseEnvelope::success(
            request_id,
            ServerView::from(server),
        ))
        .into_response(),
        Ok(Some(server)) => {
            let owns_server = match session_from_headers(&headers) {
                Some(token) => match state
                    .storage
                    .find_active_session(&session_digest(&state.config, &token))
                    .await
                {
                    Ok(Some(session)) => session.user_id == server.owner_id,
                    Ok(None) => false,
                    Err(error) => return storage_error(request_id, error),
                },
                None => false,
            };
            if owns_server {
                Json(ResponseEnvelope::success(
                    request_id,
                    ServerView::from(server),
                ))
                .into_response()
            } else {
                api_error(
                    request_id,
                    StatusCode::NOT_FOUND,
                    ErrorCode::NotFound,
                    "server not found".to_owned(),
                )
            }
        }
        Ok(None) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "server not found".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

async fn list_servers(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    Query(query): Query<ServerListQuery>,
) -> Response {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = match bounded_offset(query.offset) {
        Ok(offset) => offset,
        Err(message) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                message,
            );
        }
    };
    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if search.is_some_and(|value| value.chars().count() > 100) {
        return api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "搜索关键词最多 100 个字符".to_owned(),
        );
    }
    let category = query
        .category
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let version = query
        .version
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let category_parts = category
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if category_parts.iter().any(|part| part.chars().count() > 64)
        || category_parts.len() > 10
        || version.is_some_and(|value| value.chars().count() > 64)
    {
        return api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "分类和版本最多 64 个字符".to_owned(),
        );
    }
    let category = (!category_parts.is_empty()).then(|| category_parts.join(","));
    let edition = query
        .platform
        .as_deref()
        .filter(|value| matches!(*value, "java" | "bedrock"));
    if query.platform.is_some() && edition.is_none() {
        return api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "平台参数无效".to_owned(),
        );
    }
    let sort_by = query.sort_by.as_deref().unwrap_or("created");
    if !matches!(sort_by, "created" | "players" | "activity") {
        return api_error(
            request_id,
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "排序参数无效".to_owned(),
        );
    }
    match state
        .storage
        .list_approved_servers_page(
            limit,
            offset,
            search,
            edition,
            category.as_deref(),
            version,
            query.online,
            sort_by,
        )
        .await
    {
        Ok(servers) => Json(ResponseEnvelope::success(
            request_id,
            servers
                .into_iter()
                .map(ServerView::from)
                .collect::<Vec<_>>(),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

fn bounded_offset(offset: Option<i64>) -> Result<i64, String> {
    const MAX_SERVER_OFFSET: i64 = 100_000;
    let offset = offset.unwrap_or(0);
    (0..=MAX_SERVER_OFFSET)
        .contains(&offset)
        .then_some(offset)
        .ok_or_else(|| "分页偏移量超出允许范围".to_owned())
}

async fn favorite_state(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.favorite_state(user.id, server_id).await {
        Ok(favorited) => Json(ResponseEnvelope::success(
            request_id,
            FavoriteView { favorited },
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn toggle_favorite(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.toggle_favorite(user.id, server_id).await {
        Ok(favorited) => Json(ResponseEnvelope::success(
            request_id,
            FavoriteView { favorited },
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn list_my_favorites(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Query(query): Query<ServerListQuery>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = match bounded_offset(query.offset) {
        Ok(offset) => offset,
        Err(message) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                message,
            );
        }
    };
    match state
        .storage
        .list_favorite_servers(user.id, limit, offset)
        .await
    {
        Ok(servers) => Json(ResponseEnvelope::success(
            request_id,
            servers
                .into_iter()
                .map(ServerView::from)
                .collect::<Vec<_>>(),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn like_state(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.like_state(user.id, server_id).await {
        Ok(liked) => {
            Json(ResponseEnvelope::success(request_id, LikeView { liked })).into_response()
        }
        Err(error) => storage_error(request_id, error),
    }
}

async fn toggle_like(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.storage.toggle_like(user.id, server_id).await {
        Ok(liked) => {
            Json(ResponseEnvelope::success(request_id, LikeView { liked })).into_response()
        }
        Err(error) => storage_error(request_id, error),
    }
}

async fn list_my_servers(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Query(query): Query<ServerListQuery>,
) -> Response {
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = match bounded_offset(query.offset) {
        Ok(offset) => offset,
        Err(message) => {
            return api_error(
                request_id,
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorCode::ValidationError,
                message,
            );
        }
    };
    match state
        .storage
        .list_servers_owned(user.id, limit, offset)
        .await
    {
        Ok(servers) => Json(ResponseEnvelope::success(
            request_id,
            servers
                .into_iter()
                .map(ServerView::from)
                .collect::<Vec<_>>(),
        ))
        .into_response(),
        Err(error) => storage_error(request_id, error),
    }
}

async fn review_server(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
    headers: HeaderMap,
    Path(server_id): Path<Uuid>,
    payload: Result<Json<ReviewRequest>, JsonRejection>,
) -> Response {
    let Json(input) = match payload {
        Ok(payload) => payload,
        Err(_) => return invalid_json(request_id),
    };
    let user = match authenticated_user(&state.storage, &state.config, &headers, request_id).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if user.role != "ADMIN" {
        return api_error(
            request_id,
            StatusCode::FORBIDDEN,
            ErrorCode::Forbidden,
            "administrator permission required".to_owned(),
        );
    }
    let status = if input.approved {
        ServerStatus::Approved
    } else {
        ServerStatus::Rejected
    };
    match state.storage.set_review_status(server_id, status).await {
        Ok(Some(server)) => Json(ResponseEnvelope::success(
            request_id,
            ServerView::from(server),
        ))
        .into_response(),
        Ok(None) => api_error(
            request_id,
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "server not found".to_owned(),
        ),
        Err(error) => storage_error(request_id, error),
    }
}

fn normalized_server(owner_id: i64, input: ServerPublishInput) -> Result<NewServer, String> {
    let normalized = input.normalize().map_err(|error| error.to_string())?;
    Ok(NewServer {
        owner_id,
        name: normalized.name,
        description: normalized.description,
        edition: normalized.edition,
        category: normalized.category,
        version: normalized.version,
        host: normalized.host,
        port: i32::from(normalized.port),
        qq_group: normalized.qq_group,
        cover_url: normalized.cover_url,
        status: ServerStatus::PendingReview,
    })
}

fn session_digest(config: &Option<AppConfig>, token: &SessionToken) -> String {
    config
        .as_ref()
        .map(|config| token.digest_with_key(&config.session_secret))
        .unwrap_or_else(|| token.digest())
}

fn verification_digest(config: &Option<AppConfig>, code: &VerificationCode) -> String {
    config
        .as_ref()
        .map(|config| code.digest_with_key(&config.session_secret))
        .unwrap_or_else(|| code.digest())
}

async fn authenticated_user(
    storage: &PgStorage,
    config: &Option<AppConfig>,
    headers: &HeaderMap,
    request_id: Uuid,
) -> Result<UserRecord, Response> {
    let token = session_from_headers(headers).ok_or_else(|| unauthorized(request_id))?;
    let session = storage
        .find_active_session(&session_digest(config, &token))
        .await
        .map_err(|error| storage_error(request_id, error))?
        .ok_or_else(|| unauthorized(request_id))?;
    storage
        .find_user_by_id(session.user_id)
        .await
        .map_err(|error| storage_error(request_id, error))?
        .ok_or_else(|| unauthorized(request_id))
}

async fn issue_session(
    state: Arc<ApiState>,
    request_id: Uuid,
    user: UserRecord,
    pending_verification: bool,
) -> Response {
    let token = SessionToken::generate();
    let expires_at = Utc::now() + Duration::days(30);
    if let Err(error) = state
        .storage
        .create_session(user.id, &session_digest(&state.config, &token), expires_at)
        .await
    {
        return storage_error(request_id, error);
    }
    let cookie = session_cookie(token.expose(), 2_592_000);
    let mut headers = HeaderMap::new();
    let Ok(cookie) = HeaderValue::from_str(&cookie) else {
        return api_error(
            request_id,
            StatusCode::INTERNAL_SERVER_ERROR,
            ErrorCode::InternalError,
            "session cookie could not be created".to_owned(),
        );
    };
    headers.insert(SET_COOKIE, cookie);
    (
        headers,
        Json(ResponseEnvelope::success(
            request_id,
            AuthResult {
                user: AuthUser::from(user),
                pending_verification,
            },
        )),
    )
        .into_response()
}

fn cookie_is_secure() -> bool {
    std::env::var("QF_COOKIE_SECURE")
        .map(|value| !value.eq_ignore_ascii_case("false"))
        .unwrap_or(true)
}

fn session_cookie(value: &str, max_age: u32) -> String {
    let secure = if cookie_is_secure() { "; Secure" } else { "" };
    format!("qf_session={value}; Path=/; Max-Age={max_age}; HttpOnly{secure}; SameSite=Lax")
}

fn session_from_headers(headers: &HeaderMap) -> Option<SessionToken> {
    let cookie = headers.get("cookie")?.to_str().ok()?;
    let value = cookie
        .split(';')
        .find_map(|part| part.trim().strip_prefix("qf_session="))?;
    SessionToken::parse(value).ok()
}

fn github_config(config: &Option<AppConfig>) -> Option<(&str, &str, &str, url::Url)> {
    let config = config.as_ref()?;
    let frontend = url::Url::parse(config.frontend_url.as_deref()?).ok()?;
    if !matches!(frontend.scheme(), "https" | "http") || frontend.host_str().is_none() {
        return None;
    }
    Some((
        config.github_client_id.as_deref()?,
        config.github_client_secret.as_ref()?.as_str(),
        config.github_redirect_uri.as_deref()?,
        frontend,
    ))
}

fn frontend_redirect(frontend: &url::Url, path_and_query: &str) -> Response {
    let mut target = frontend.clone();
    let (path, query) = path_and_query
        .split_once('?')
        .unwrap_or((path_and_query, ""));
    target.set_path(path);
    target.set_query((!query.is_empty()).then_some(query));
    Redirect::temporary(target.as_str()).into_response()
}

async fn oauth_status(
    State(state): State<Arc<ApiState>>,
    Extension(request_id): Extension<Uuid>,
) -> Response {
    let enabled = github_config(&state.config).is_some();
    Json(ResponseEnvelope::success(
        request_id,
        OAuthStatus {
            providers: OAuthProviders {
                github: GithubStatus {
                    backend_enabled: enabled,
                    login_url: enabled.then_some("/api/v2/auth/github/start"),
                },
            },
        },
    ))
    .into_response()
}

async fn github_start(State(state): State<Arc<ApiState>>) -> Response {
    let Some((client_id, _, redirect_uri, _)) = github_config(&state.config) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let state_token = SessionToken::generate();
    let verifier = SessionToken::generate();
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(sha2::Sha256::digest(verifier.expose().as_bytes()));
    if state
        .storage
        .save_oauth_state(
            &session_digest(&state.config, &state_token),
            verifier.expose(),
            Utc::now() + Duration::minutes(10),
        )
        .await
        .is_err()
    {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    let mut url = match url::Url::parse("https://github.com/login/oauth/authorize") {
        Ok(url) => url,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("state", state_token.expose())
        .append_pair("scope", "read:user user:email")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    Redirect::temporary(url.as_str()).into_response()
}

async fn github_callback(
    State(state): State<Arc<ApiState>>,
    Query(query): Query<GithubCallback>,
) -> Response {
    let Some((client_id, client_secret, redirect_uri, frontend)) = github_config(&state.config)
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let failed = || frontend_redirect(&frontend, "/login?oauth=github&error=oauth_failed");
    if query.error.is_some() {
        return failed();
    }
    let (Some(code), Some(state_token)) = (query.code, query.state) else {
        return failed();
    };
    let Ok(state_token) = SessionToken::parse(&state_token) else {
        return failed();
    };
    let verifier = match state
        .storage
        .consume_oauth_state(&session_digest(&state.config, &state_token))
        .await
    {
        Ok(Some(verifier)) => verifier,
        _ => return failed(),
    };
    if PkceVerifier::parse(&verifier).is_err() {
        return failed();
    }
    #[derive(Deserialize)]
    struct TokenReply {
        access_token: Option<String>,
    }
    let http = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(client) => client,
        Err(_) => return failed(),
    };
    let token_response = match http.post("https://github.com/login/oauth/access_token").header("accept", "application/json").json(&serde_json::json!({"client_id": client_id, "client_secret": client_secret, "code": code, "redirect_uri": redirect_uri, "code_verifier": verifier})).send().await.and_then(|response| response.error_for_status()) { Ok(response) => response, Err(_) => return failed() };
    let token = match token_response.json::<TokenReply>().await {
        Ok(TokenReply {
            access_token: Some(token),
        }) => token,
        _ => return failed(),
    };
    #[derive(Deserialize)]
    struct GithubUser {
        id: u64,
        login: String,
    }
    let profile_response = match http
        .get("https://api.github.com/user")
        .header("user-agent", "qianfu-api")
        .bearer_auth(&token)
        .send()
        .await
        .and_then(|response| response.error_for_status())
    {
        Ok(response) => response,
        Err(_) => return failed(),
    };
    let profile = match profile_response.json::<GithubUser>().await {
        Ok(profile) => profile,
        Err(_) => return failed(),
    };
    let identity = profile.id.to_string();
    let user = match state.storage.find_oauth_user(&identity).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            #[derive(Deserialize)]
            struct GithubEmail {
                email: String,
                primary: bool,
                verified: bool,
            }
            let emails_response = match http
                .get("https://api.github.com/user/emails")
                .header("user-agent", "qianfu-api")
                .bearer_auth(&token)
                .send()
                .await
                .and_then(|response| response.error_for_status())
            {
                Ok(response) => response,
                Err(_) => return failed(),
            };
            let emails = match emails_response.json::<Vec<GithubEmail>>().await {
                Ok(emails) => emails,
                Err(_) => return failed(),
            };
            let Some(email) = emails
                .into_iter()
                .find(|email| email.primary && email.verified)
            else {
                return frontend_redirect(
                    &frontend,
                    "/login?oauth=github&error=verified_email_required",
                );
            };
            let user = match state
                .storage
                .create_github_user(&email.email, Some(&profile.login))
                .await
            {
                Ok(user) => user,
                Err(_) => {
                    return frontend_redirect(
                        &frontend,
                        "/login?oauth=github&error=account_link_required",
                    );
                }
            };
            if state
                .storage
                .link_github_identity(user.id, &identity)
                .await
                .is_err()
            {
                return failed();
            }
            user
        }
        Err(_) => return failed(),
    };
    let session = SessionToken::generate();
    if state
        .storage
        .create_session(
            user.id,
            &session_digest(&state.config, &session),
            Utc::now() + Duration::days(30),
        )
        .await
        .is_err()
    {
        return failed();
    }
    let mut response = frontend_redirect(&frontend, "/dashboard");
    if let Ok(cookie) = HeaderValue::from_str(&session_cookie(session.expose(), 2_592_000)) {
        response.headers_mut().insert(SET_COOKIE, cookie);
    }
    response
}

fn unauthorized(request_id: Uuid) -> Response {
    api_error(
        request_id,
        StatusCode::UNAUTHORIZED,
        ErrorCode::Unauthorized,
        "authentication required".to_owned(),
    )
}

fn invalid_json(request_id: Uuid) -> Response {
    api_error(
        request_id,
        StatusCode::BAD_REQUEST,
        ErrorCode::ValidationError,
        "invalid JSON request".to_owned(),
    )
}

fn storage_error(request_id: Uuid, error: StorageError) -> Response {
    let (status, code, message) = match error {
        StorageError::Database(error)
            if error
                .as_database_error()
                .and_then(|error| error.code())
                .as_deref()
                == Some("23505") =>
        {
            (
                StatusCode::CONFLICT,
                ErrorCode::Conflict,
                "account already exists",
            )
        }
        StorageError::NotFound => (
            StatusCode::NOT_FOUND,
            ErrorCode::NotFound,
            "resource not found",
        ),
        StorageError::InvalidDomain | StorageError::DomainQuotaReached => (
            StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::ValidationError,
            "domain request cannot be accepted",
        ),
        StorageError::Conflict => (
            StatusCode::TOO_MANY_REQUESTS,
            ErrorCode::Conflict,
            "please wait before requesting another reset email",
        ),
        StorageError::Database(_)
        | StorageError::Migration(_)
        | StorageError::InvalidServerPort
        | StorageError::TaskPayload(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            ErrorCode::InternalError,
            "database operation failed",
        ),
    };
    api_error(request_id, status, code, message.to_owned())
}

fn api_error(request_id: Uuid, status: StatusCode, code: ErrorCode, message: String) -> Response {
    (
        status,
        Json(ResponseEnvelope::<()>::error(
            request_id,
            ApiError::new(code, message),
        )),
    )
        .into_response()
}

fn base_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/health", get(health))
        .route("/api/v2/health", get(health))
        .route("/metrics", get(metrics))
        .route("/api/v2/servers/validate-publish", post(validate_publish))
}

fn with_common_layers<S>(router: Router<S>) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    // Layers apply only to routes already registered, so install them last.
    router
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(middleware::from_fn(security_headers_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .layer(middleware::from_fn(cors_middleware))
}

pub fn router() -> Router {
    with_common_layers(base_router::<()>())
}

pub fn router_with_storage(storage: PgStorage) -> Router {
    router_with_storage_config(storage, None)
}

pub fn router_with_storage_and_config(storage: PgStorage, config: AppConfig) -> Router {
    router_with_storage_config(storage, Some(config))
}

fn router_with_storage_config(storage: PgStorage, config: Option<AppConfig>) -> Router {
    let router = base_router::<Arc<ApiState>>()
        .route("/api/v2/auth/register", post(register))
        .route("/api/v2/auth/login", post(login))
        .route("/api/v2/auth/me", get(me))
        .route("/api/v2/profile", get(me).put(update_profile))
        .route("/api/v2/profile/password", put(change_password))
        .route("/api/v2/auth/logout", post(logout))
        .route("/api/v2/auth/verify-email", post(verify_email))
        .route("/api/v2/auth/verify-code", post(verify_email))
        .route("/api/v2/auth/send-code", post(send_code))
        .route(
            "/api/v2/auth/password-reset/request",
            post(request_password_reset),
        )
        .route(
            "/api/v2/auth/password-reset/complete",
            post(complete_password_reset),
        )
        .route("/api/v2/auth/oauth-status", get(oauth_status))
        .route("/api/v2/auth/github/start", get(github_start))
        .route("/api/v2/auth/github/callback", get(github_callback))
        .route(
            "/api/v2/dns/suffixes",
            get(list_dns_suffixes).post(create_dns_suffix),
        )
        .route(
            "/api/v2/servers/{server_id}/domain",
            get(get_server_domain)
                .post(request_server_domain)
                .delete(revoke_server_domain),
        )
        .route(
            "/api/v2/admin/servers/{server_id}/domain/approve",
            post(approve_server_domain),
        )
        .route("/api/v2/ready", get(readiness))
        .route("/api/v2/public/stats", get(public_stats))
        .route("/api/v2/user/checkin/status", get(checkin_status))
        .route("/api/v2/user/checkin", post(checkin))
        .route("/api/v2/servers", post(create_server).get(list_servers))
        .route("/api/v2/servers/mine", get(list_my_servers))
        .route("/api/v2/me/favorites", get(list_my_favorites))
        .route("/api/v2/servers/{server_id}/like", post(toggle_like))
        .route("/api/v2/servers/{server_id}/like-state", get(like_state))
        .route(
            "/api/v2/servers/{server_id}/favorite",
            post(toggle_favorite),
        )
        .route(
            "/api/v2/servers/{server_id}/favorite-state",
            get(favorite_state),
        )
        .route(
            "/api/v2/servers/{server_id}",
            get(get_server).put(update_server).delete(delete_server),
        )
        .route(
            "/api/v2/admin/servers/{server_id}/review",
            post(review_server),
        )
        .with_state(Arc::new(ApiState {
            storage: Arc::new(storage),
            config,
        }));
    with_common_layers(router)
}

#[cfg(test)]
mod tests {
    use super::is_valid_origin;

    #[test]
    fn cors_origins_must_be_plain_http_origins() {
        assert!(is_valid_origin("https://app.example.com"));
        assert!(is_valid_origin("http://localhost:5173"));
        assert!(!is_valid_origin("https://app.example.com/path"));
        assert!(!is_valid_origin("https://app.example.com?next=/"));
        assert!(!is_valid_origin("https://app.example.com#fragment"));
        assert!(!is_valid_origin("null"));
    }
}
