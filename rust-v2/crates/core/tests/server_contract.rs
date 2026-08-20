use qianfu_core::{ServerEdition, ServerError, ServerPublishInput};

fn input(edition: ServerEdition) -> ServerPublishInput {
    ServerPublishInput {
        name: "星际生存".to_owned(),
        description: "一个公开的生存服务器".to_owned(),
        edition,
        category: None,
        version: None,
        host: "play.example.com".to_owned(),
        port: None,
        qq_group: Some("2293237813".to_owned()),
        cover_url: Some("https://cdn.example.com/server-cover.webp".to_owned()),
    }
}

#[test]
fn java_and_bedrock_use_different_default_ports() {
    let java = input(ServerEdition::Java).normalize().unwrap();
    let bedrock = input(ServerEdition::Bedrock).normalize().unwrap();

    assert_eq!(java.port, 25565);
    assert_eq!(bedrock.port, 19132);
}

#[test]
fn normalized_publish_data_keeps_name_and_description_separate() {
    let mut draft = input(ServerEdition::Java);
    draft.name = "  星际生存  ".to_owned();
    draft.description = "  只展示发布者填写的简介  ".to_owned();

    let normalized = draft.normalize().unwrap();

    assert_eq!(normalized.name, "星际生存");
    assert_eq!(normalized.description, "只展示发布者填写的简介");
    assert_eq!(normalized.qq_group.as_deref(), Some("2293237813"));
}

#[test]
fn publish_rejects_private_probe_targets() {
    let mut draft = input(ServerEdition::Java);
    draft.host = "127.0.0.1".to_owned();

    assert_eq!(draft.normalize(), Err(ServerError::PrivateHost));
}

#[test]
fn publish_rejects_non_public_documentation_and_mapped_ranges() {
    for host in [
        "100.64.0.1",
        "192.0.2.1",
        "198.18.0.1",
        "203.0.113.10",
        "2001:db8::1",
        "::ffff:10.0.0.1",
    ] {
        let mut draft = input(ServerEdition::Java);
        draft.host = host.to_owned();
        assert_eq!(draft.normalize(), Err(ServerError::PrivateHost), "{host}");
    }
}

#[test]
fn publish_rejects_invalid_qq_and_cover_values() {
    let mut draft = input(ServerEdition::Java);
    draft.qq_group = Some("not-a-qq".to_owned());
    draft.cover_url = Some("javascript:alert(1)".to_owned());

    assert_eq!(draft.normalize(), Err(ServerError::InvalidQqGroup));

    draft.qq_group = None;
    assert_eq!(draft.normalize(), Err(ServerError::InvalidCoverUrl));
}
