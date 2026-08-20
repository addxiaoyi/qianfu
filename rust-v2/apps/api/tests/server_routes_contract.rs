use axum::{body::Body, http::Request};
use qianfu_storage::PgStorage;
use tower::ServiceExt;

#[tokio::test]
async fn publish_validation_returns_bedrock_preview_without_side_effects() {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/servers/validate-publish")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{
                "name":"基岩生存",
                "description":"基岩版公开服务器",
                "edition":"bedrock",
                "category":"生存",
                "version":"1.21.1",
                "host":"play.example.cn",
                "qq_group":"2293237813"
            }"#,
        ))
        .unwrap();

    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let response = qianfu_api::router_with_storage(storage)
        .oneshot(request)
        .await
        .unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["ok"], true);
    assert_eq!(json["data"]["edition"], "bedrock");
    assert_eq!(json["data"]["port"], 19132);
    assert_eq!(json["data"]["description"], "基岩版公开服务器");
    assert_eq!(json["data"]["category"], "生存");
    assert_eq!(json["data"]["version"], "1.21.1");
    assert!(json["data"].get("owner_id").is_none());
}

#[tokio::test]
async fn publish_validation_rejects_oversized_discovery_metadata() {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/servers/validate-publish")
        .header("content-type", "application/json")
        .body(Body::from(format!(
            r#"{{"name":"测试","description":"测试服务器","edition":"java","category":"{}","host":"play.example.com"}}"#,
            "x".repeat(65)
        )))
        .unwrap();

    let response = qianfu_api::router().oneshot(request).await.unwrap();
    assert_eq!(response.status(), 422);
}

#[tokio::test]
async fn publish_validation_rejects_private_targets() {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/servers/validate-publish")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{
                "name":"测试",
                "description":"测试服务器",
                "edition":"java",
                "host":"127.0.0.1"
            }"#,
        ))
        .unwrap();

    let response = qianfu_api::router().oneshot(request).await.unwrap();

    assert_eq!(response.status(), 422);
}

#[tokio::test]
async fn publish_validation_rejects_non_public_network_ranges() {
    for host in [
        "100.64.0.1",
        "192.0.2.1",
        "198.18.0.1",
        "203.0.113.1",
        "2001:db8::1",
        "::ffff:10.0.0.1",
    ] {
        let request = Request::builder()
            .method("POST")
            .uri("/api/v2/servers/validate-publish")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{"name":"测试","description":"测试服务器","edition":"java","host":"{host}"}}"#
            )))
            .unwrap();

        let response = qianfu_api::router().oneshot(request).await.unwrap();
        assert_eq!(response.status(), 422, "{host}");
    }
}

#[tokio::test]
async fn malformed_json_uses_the_common_error_envelope() {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/servers/validate-publish")
        .header("content-type", "application/json")
        .body(Body::from("{invalid"))
        .unwrap();

    let response = qianfu_api::router().oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["ok"], false);
    assert_eq!(json["error"]["code"], "VALIDATION_ERROR");
}

#[tokio::test]
async fn state_changing_requests_reject_cross_site_origins() {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/servers/validate-publish")
        .header("host", "mc-u.top")
        .header("origin", "https://attacker.example")
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let response = qianfu_api::router().oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["ok"], false);
    assert_eq!(json["error"]["code"], "FORBIDDEN");
    assert!(json["request_id"].as_str().is_some());
}

#[tokio::test]
async fn preflight_never_reflects_an_unconfigured_origin() {
    let request = Request::builder()
        .method("OPTIONS")
        .uri("/api/v2/servers/validate-publish")
        .header("origin", "https://attacker.example")
        .body(Body::empty())
        .unwrap();

    let response = qianfu_api::router().oneshot(request).await.unwrap();

    assert_eq!(response.status(), 403);
    assert!(
        response
            .headers()
            .get("access-control-allow-origin")
            .is_none()
    );
}

#[tokio::test]
async fn favorites_require_an_authenticated_session() {
    let server_id = "550e8400-e29b-41d4-a716-446655440000";
    for request in [
        Request::builder()
            .uri(format!("/api/v2/servers/{server_id}/favorite-state"))
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("POST")
            .uri(format!("/api/v2/servers/{server_id}/favorite"))
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .uri(format!("/api/v2/servers/{server_id}/like-state"))
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("POST")
            .uri(format!("/api/v2/servers/{server_id}/like"))
            .body(Body::empty())
            .unwrap(),
    ] {
        let storage =
            PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
        let response = qianfu_api::router_with_storage(storage)
            .oneshot(request)
            .await
            .unwrap();
        let status = response.status();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(status, 401, "{}", String::from_utf8_lossy(&body));
    }
}

#[tokio::test]
async fn server_mutations_require_an_authenticated_session() {
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let server_id = "550e8400-e29b-41d4-a716-446655440000";
    let update = Request::builder()
        .method("PUT")
        .uri(format!("/api/v2/servers/{server_id}"))
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"name":"测试服务器","description":"一个公开的测试服务器","edition":"java","host":"play.example.com"}"#,
        ))
        .unwrap();
    let delete = Request::builder()
        .method("DELETE")
        .uri(format!("/api/v2/servers/{server_id}"))
        .body(Body::empty())
        .unwrap();

    for request in [update, delete] {
        let response = qianfu_api::router_with_storage(storage.clone())
            .oneshot(request)
            .await
            .unwrap();
        assert_eq!(response.status(), 401);
    }
}

#[tokio::test]
async fn server_review_requires_an_authenticated_admin_session() {
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/admin/servers/550e8400-e29b-41d4-a716-446655440000/review")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"approved":true}"#))
        .unwrap();

    let response = qianfu_api::router_with_storage(storage)
        .oneshot(request)
        .await
        .unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn discovery_rejects_unbounded_category_lists_before_storage_access() {
    let categories = (0..11).map(|index| format!("c{index}")).collect::<Vec<_>>().join(",");
    let request = Request::builder()
        .uri(format!("/api/v2/servers?category={categories}"))
        .body(Body::empty())
        .unwrap();
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let response = qianfu_api::router_with_storage(storage)
        .oneshot(request)
        .await
        .unwrap();
    assert_eq!(response.status(), 422);
}

#[tokio::test]
async fn password_change_requires_an_authenticated_session() {
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let request = Request::builder()
        .method("PUT")
        .uri("/api/v2/profile/password")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"current_password":"old-password","new_password":"new-password"}"#,
        ))
        .unwrap();
    let response = qianfu_api::router_with_storage(storage)
        .oneshot(request)
        .await
        .unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn password_reset_request_keeps_invalid_email_non_enumerating() {
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/auth/password-reset/request")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"email":"not-an-email"}"#))
        .unwrap();

    let response = qianfu_api::router_with_storage(storage)
        .oneshot(request)
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["ok"], true);
    assert_eq!(json["data"]["sent"], true);
}

#[tokio::test]
async fn password_reset_complete_rejects_malformed_token_before_storage_access() {
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    let request = Request::builder()
        .method("POST")
        .uri("/api/v2/auth/password-reset/complete")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"email":"user@example.com","token":"bad","password":"Strong-password-123"}"#,
        ))
        .unwrap();

    let response = qianfu_api::router_with_storage(storage)
        .oneshot(request)
        .await
        .unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn public_server_listing_rejects_unbounded_pagination_and_search() {
    let storage = PgStorage::connect_lazy("postgres://qianfu:qianfu@127.0.0.1/qianfu", 1).unwrap();
    for uri in [
        "/api/v2/servers?offset=-1",
        "/api/v2/servers?offset=100001",
        "/api/v2/servers?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "/api/v2/servers?platform=console",
        "/api/v2/servers?sortBy=secret",
    ] {
        let response = qianfu_api::router_with_storage(storage.clone())
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), 422, "{uri}");
    }
}
