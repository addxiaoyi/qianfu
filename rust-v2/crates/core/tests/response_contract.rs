use qianfu_core::{ApiError, ErrorCode, ResponseEnvelope};
use uuid::Uuid;

#[test]
fn success_response_has_request_id_and_data() {
    let request_id = Uuid::new_v4();
    let response = ResponseEnvelope::success(request_id, "ready");

    assert!(response.ok);
    assert_eq!(response.request_id, request_id);
    assert_eq!(response.data, Some("ready"));
    assert!(response.error.is_none());
}

#[test]
fn error_response_exposes_stable_machine_code() {
    let request_id = Uuid::new_v4();
    let response = ResponseEnvelope::<()>::error(
        request_id,
        ApiError::new(ErrorCode::NotFound, "resource not found"),
    );

    assert!(!response.ok);
    assert_eq!(
        response.error.as_ref().map(|error| error.code),
        Some(ErrorCode::NotFound)
    );
    assert_eq!(
        response.error.as_ref().map(|error| error.message.as_str()),
        Some("resource not found")
    );
}
