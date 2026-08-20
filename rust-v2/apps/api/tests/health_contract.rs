use axum::{body::Body, http::Request};
use qianfu_api::router;
use tower::ServiceExt;

#[tokio::test]
async fn health_endpoint_is_machine_readable() {
    let response = router()
        .oneshot(Request::get("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    assert_eq!(
        response.headers().get("x-content-type-options").unwrap(),
        "nosniff"
    );
    assert_eq!(response.headers().get("x-frame-options").unwrap(), "DENY");
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["ok"], true);
    assert_eq!(json["data"]["status"], "healthy");
    assert!(json["request_id"].as_str().is_some());
}

#[tokio::test]
async fn api_responses_include_browser_hardening_headers() {
    let request = Request::builder()
        .uri("/api/v2/health")
        .body(Body::empty())
        .unwrap();
    let response = qianfu_api::router().oneshot(request).await.unwrap();
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
    assert_eq!(response.headers()["x-frame-options"], "DENY");
    assert!(
        response.headers()["content-security-policy"]
            .to_str()
            .unwrap()
            .contains("default-src 'none'")
    );
}
