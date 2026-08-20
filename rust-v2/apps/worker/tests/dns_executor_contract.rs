use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use qianfu_core::DnsTaskPayload;
use qianfu_providers::{DnsProvider, DnsRecord, ProviderError};
use qianfu_worker::execute_dns_payload;

#[derive(Clone, Default)]
struct FakeProvider {
    ensured: Arc<Mutex<Vec<DnsRecord>>>,
    deleted: Arc<Mutex<Vec<String>>>,
}

#[async_trait]
impl DnsProvider for FakeProvider {
    async fn ensure_record(&self, record: &DnsRecord) -> Result<String, ProviderError> {
        self.ensured.lock().unwrap().push(record.clone());
        Ok(format!("record-{}", self.ensured.lock().unwrap().len()))
    }

    async fn delete_record(&self, record_id: &str) -> Result<(), ProviderError> {
        self.deleted.lock().unwrap().push(record_id.to_owned());
        Ok(())
    }
}

fn payload() -> DnsTaskPayload {
    DnsTaskPayload {
        domain: "play.example.com".to_owned(),
        target: "node.example.net".to_owned(),
        port: 25570,
        ttl: 300,
        provider: "CLOUDFLARE".to_owned(),
        zone: "example.com".to_owned(),
        record_ids: vec!["old-a".to_owned(), "old-srv".to_owned()],
    }
}

#[tokio::test]
async fn apply_executes_each_desired_record_and_returns_provider_ids() {
    let provider = FakeProvider::default();
    let ids = execute_dns_payload(&payload(), false, &provider)
        .await
        .unwrap();

    assert_eq!(ids, vec!["record-1", "record-2"]);
    assert_eq!(provider.ensured.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn delete_only_removes_platform_record_ids() {
    let provider = FakeProvider::default();

    execute_dns_payload(&payload(), true, &provider)
        .await
        .unwrap();

    assert_eq!(
        *provider.deleted.lock().unwrap(),
        vec!["old-a".to_owned(), "old-srv".to_owned()]
    );
    assert!(provider.ensured.lock().unwrap().is_empty());
}
