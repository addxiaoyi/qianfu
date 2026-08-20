use qianfu_providers::{DnsRecordType, aliyun_signature, build_dns_records, split_record_name};

#[test]
fn dns_policy_matches_java_and_bedrock_address_rules() {
    let records = build_dns_records("play.example.com", "203.0.113.10", 25565, 300).unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].record_type, DnsRecordType::A);

    let records = build_dns_records("play.example.com", "node.example.net", 25570, 600).unwrap();
    assert_eq!(records[0].record_type, DnsRecordType::Cname);
    assert_eq!(records[1].record_type, DnsRecordType::Srv);
    assert_eq!(records[1].content, "0 0 25570 play.example.com");
}

#[test]
fn dns_policy_supports_ipv6_and_rejects_invalid_target() {
    let records = build_dns_records("play.example.com", "2001:db8::10", 19132, 300).unwrap();
    assert_eq!(records[0].record_type, DnsRecordType::Aaaa);
    assert_eq!(records[1].record_type, DnsRecordType::Srv);
    assert!(build_dns_records("play.example.com", "not a target", 25565, 300).is_err());
}

#[test]
fn aliyun_signature_changes_when_parameters_change() {
    let first = aliyun_signature("secret", "GET", "Action=AddDomainRecord&Version=2015-01-09");
    let second = aliyun_signature(
        "secret",
        "GET",
        "Action=DeleteDomainRecord&Version=2015-01-09",
    );

    assert_ne!(first, second);
    assert!(!first.is_empty());
}

#[test]
fn aliyun_record_names_are_split_against_the_bound_zone() {
    assert_eq!(
        split_record_name("_minecraft._tcp.play.example.com", "example.com"),
        ("_minecraft._tcp.play".to_owned(), "example.com".to_owned())
    );
    assert_eq!(
        split_record_name("example.com", "example.com"),
        ("@".to_owned(), "example.com".to_owned())
    );
}
