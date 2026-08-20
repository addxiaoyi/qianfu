use qianfu_core::{DnsTaskPayload, TaskPayload};
use qianfu_storage::{NewServer, ServerEdition, ServerStatus, TaskInsert};
use uuid::Uuid;

#[test]
fn new_server_defaults_to_pending_review() {
    let server = NewServer::new(42, "StarMC", "star-mc.top", ServerEdition::Java);

    assert_eq!(server.owner_id, 42);
    assert_eq!(server.port, 25565);
    assert_eq!(server.status, ServerStatus::PendingReview);
}

#[test]
fn task_insert_has_stable_idempotency_identity() {
    let resource_id = Uuid::new_v4();
    let first = TaskInsert::new("dns_apply", resource_id);
    let second = TaskInsert::new("dns_apply", resource_id);

    assert_eq!(first.idempotency_key, second.idempotency_key);
    assert_eq!(first.attempts, 0);
}

#[test]
fn task_insert_serializes_execution_payload() {
    let payload = TaskPayload::DnsApply(DnsTaskPayload {
        domain: "play.example.com".to_owned(),
        target: "203.0.113.10".to_owned(),
        port: 25565,
        ttl: 300,
        provider: "CLOUDFLARE".to_owned(),
        zone: "example.com".to_owned(),
        record_ids: Vec::new(),
    });
    let task = TaskInsert::with_payload("dns_apply", uuid::Uuid::new_v4(), &payload).unwrap();

    assert_eq!(task.payload["type"], "dns_apply");
    assert_eq!(task.payload["zone"], "example.com");
}
