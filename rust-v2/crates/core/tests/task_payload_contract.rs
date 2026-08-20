use qianfu_core::{DnsTaskPayload, TaskKind, TaskPayload};
use uuid::Uuid;

#[test]
fn dns_task_payload_round_trips_without_losing_provider_metadata() {
    let payload = TaskPayload::DnsApply(DnsTaskPayload {
        domain: "play.example.com".to_owned(),
        target: "node.example.net".to_owned(),
        port: 25570,
        ttl: 300,
        provider: "CLOUDFLARE".to_owned(),
        zone: "example.com".to_owned(),
        record_ids: Vec::new(),
    });
    let encoded = serde_json::to_string(&payload).unwrap();
    let decoded: TaskPayload = serde_json::from_str(&encoded).unwrap();

    assert_eq!(decoded, payload);
    assert_eq!(payload.kind(), TaskKind::DnsApply);
}

#[test]
fn task_payload_supports_resource_identity() {
    let resource_id = Uuid::new_v4();
    let payload = TaskPayload::DeleteResource { resource_id };

    assert_eq!(payload.resource_id(), Some(resource_id));
}
