use qianfu_providers::{ProbeError, probe_server};

#[tokio::test]
async fn rejects_invalid_probe_targets_before_network_access() {
    assert_eq!(
        probe_server("bad host", 25565, "java", 500).await,
        Err(ProbeError::InvalidHost)
    );
    assert_eq!(
        probe_server("127.0.0.1", 0, "java", 500).await,
        Err(ProbeError::InvalidHost)
    );
}

#[tokio::test]
async fn rejects_private_targets_to_prevent_worker_ssrf() {
    for host in [
        "127.0.0.1",
        "100.64.0.1",
        "192.0.2.1",
        "2001:db8::1",
        "::ffff:10.0.0.1",
    ] {
        assert_eq!(
            probe_server(host, 25565, "java", 500).await,
            Err(ProbeError::PrivateTarget),
            "{host}"
        );
    }
}

#[tokio::test]
async fn reports_connection_failure_without_panicking() {
    let error = probe_server("example.com", 1, "java", 100)
        .await
        .expect_err("port 1 should not be open");
    assert!(matches!(
        error,
        ProbeError::Connection | ProbeError::Timeout
    ));
}
