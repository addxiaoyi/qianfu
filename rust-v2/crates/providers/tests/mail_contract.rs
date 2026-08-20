use qianfu_core::SecretString;
use qianfu_providers::{
    MailAccount, MailAccountRegistry, MailMessage, MailProtocol, Pop3Settings, SmtpSettings,
    parse_pop3_list,
};

fn account(id: &str, primary: bool) -> MailAccount {
    MailAccount {
        id: id.to_owned(),
        label: id.to_owned(),
        username: format!("{id}@gmx.com"),
        password: SecretString::from("mail-secret".to_owned()),
        from: format!("{id}@gmx.com"),
        primary,
        enabled: true,
        smtp: SmtpSettings {
            host: "mail.gmx.com".to_owned(),
            port: 465,
            starttls_port: Some(587),
        },
        pop3: Some(Pop3Settings {
            host: "pop.gmx.net".to_owned(),
            port: 995,
            protocol: MailProtocol::Pop3,
            implicit_tls: true,
        }),
    }
}

#[test]
fn registry_selects_the_single_enabled_primary_account() {
    let registry = MailAccountRegistry::new(vec![account("main", true), account("backup", false)]);

    assert_eq!(registry.primary().unwrap().id, "main");
}

#[test]
fn registry_rejects_multiple_primary_accounts() {
    let registry = MailAccountRegistry::new(vec![account("one", true), account("two", true)]);

    assert!(registry.primary().is_err());
}

#[test]
fn registry_debug_output_never_contains_mail_password() {
    let registry = MailAccountRegistry::new(vec![account("main", true)]);

    assert!(!format!("{registry:?}").contains("mail-secret"));
    assert_eq!(
        registry.primary().unwrap().pop3.as_ref().unwrap().host,
        "pop.gmx.net"
    );
}

#[test]
fn pop3_list_parser_keeps_message_ids_only() {
    let response = "+OK 2 messages\r\n1 1200\r\n2 800\r\n.\r\n";

    assert_eq!(parse_pop3_list(response).unwrap(), vec![1, 2]);
}

#[test]
fn mail_message_rejects_invalid_recipient_and_empty_subject() {
    assert!(MailMessage::new(vec!["not-an-email".to_owned()], "验证码", "123456").is_err());
    assert!(MailMessage::new(vec!["user@example.com".to_owned()], "", "123456").is_err());
    assert!(MailMessage::new(vec!["user@example.com".to_owned()], "验证码", "123456").is_ok());
}
