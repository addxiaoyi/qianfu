use std::fmt;

use email_address::EmailAddress;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor, message::Mailbox,
    transport::smtp::authentication::Credentials,
};
use qianfu_core::SecretString;
use thiserror::Error;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::TcpStream,
    time::{Duration, timeout},
};
use tokio_native_tls::{TlsConnector, TlsStream};

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum MailProtocol {
    Pop3,
    Imap,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SmtpSettings {
    pub host: String,
    pub port: u16,
    pub starttls_port: Option<u16>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct Pop3Settings {
    pub host: String,
    pub port: u16,
    pub protocol: MailProtocol,
    pub implicit_tls: bool,
}

#[derive(Clone, Eq, PartialEq)]
pub struct MailAccount {
    pub id: String,
    pub label: String,
    pub username: String,
    pub password: SecretString,
    pub from: String,
    pub primary: bool,
    pub enabled: bool,
    pub smtp: SmtpSettings,
    pub pop3: Option<Pop3Settings>,
}

impl fmt::Debug for MailAccount {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("MailAccount")
            .field("id", &self.id)
            .field("label", &self.label)
            .field("username", &self.username)
            .field("password", &self.password)
            .field("from", &self.from)
            .field("primary", &self.primary)
            .field("enabled", &self.enabled)
            .field("smtp", &self.smtp)
            .field("pop3", &self.pop3)
            .finish()
    }
}

#[derive(Debug, Error, Eq, PartialEq)]
pub enum MailError {
    #[error("no enabled primary mail account is configured")]
    NoPrimary,
    #[error("multiple enabled primary mail accounts are configured")]
    MultiplePrimary,
    #[error("POP3 is not configured for this mail account")]
    Pop3NotConfigured,
    #[error("mail provider connection failed")]
    ConnectionFailed,
    #[error("mail provider rejected the command")]
    Rejected,
    #[error("mail provider returned an invalid response")]
    InvalidResponse,
    #[error("mail provider I/O failed")]
    Io,
    #[error("mail provider TLS negotiation failed")]
    Tls,
    #[error("mail message is invalid")]
    InvalidMessage,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct MailMessage {
    pub to: Vec<String>,
    pub subject: String,
    pub text: String,
}

impl MailMessage {
    pub fn new(
        to: Vec<String>,
        subject: impl Into<String>,
        text: impl Into<String>,
    ) -> Result<Self, MailError> {
        let subject = subject.into();
        let text = text.into();
        let recipients = to
            .into_iter()
            .map(|value| value.trim().to_owned())
            .collect::<Vec<_>>();
        if recipients.is_empty()
            || recipients
                .iter()
                .any(|value| value.parse::<EmailAddress>().is_err())
            || subject.trim().is_empty()
            || text.trim().is_empty()
        {
            return Err(MailError::InvalidMessage);
        }
        Ok(Self {
            to: recipients,
            subject,
            text,
        })
    }
}

#[derive(Debug, Clone)]
pub struct MailAccountRegistry {
    accounts: Vec<MailAccount>,
}

impl MailAccountRegistry {
    pub fn new(accounts: Vec<MailAccount>) -> Self {
        Self { accounts }
    }

    pub fn primary(&self) -> Result<&MailAccount, MailError> {
        let mut accounts = self
            .accounts
            .iter()
            .filter(|account| account.enabled && account.primary);
        let account = accounts.next().ok_or(MailError::NoPrimary)?;
        if accounts.next().is_some() {
            return Err(MailError::MultiplePrimary);
        }
        Ok(account)
    }

    pub fn get(&self, id: &str) -> Option<&MailAccount> {
        self.accounts
            .iter()
            .find(|account| account.id == id && account.enabled)
    }
}

trait MailStream: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send {}

impl<T> MailStream for T where T: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send {}

type BoxMailStream = Box<dyn MailStream>;
type MailReader = BufReader<BoxMailStream>;

impl MailAccount {
    pub async fn send_message(&self, message: &MailMessage) -> Result<(), MailError> {
        if !self.enabled {
            return Err(MailError::Rejected);
        }
        let mut builder = Message::builder().from(
            self.from
                .parse::<Mailbox>()
                .map_err(|_| MailError::InvalidMessage)?,
        );
        for recipient in &message.to {
            builder = builder.to(recipient
                .parse::<Mailbox>()
                .map_err(|_| MailError::InvalidMessage)?);
        }
        let email = builder
            .subject(&message.subject)
            .body(message.text.clone())
            .map_err(|_| MailError::InvalidMessage)?;
        let transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&self.smtp.host)
            .map_err(|_| MailError::ConnectionFailed)?
            .port(self.smtp.starttls_port.unwrap_or(self.smtp.port))
            .credentials(Credentials::new(
                self.username.clone(),
                self.password.as_str().to_owned(),
            ))
            .build();
        transport
            .send(email)
            .await
            .map(|_| ())
            .map_err(|_| MailError::Rejected)
    }

    pub async fn pop3_list(&self) -> Result<Vec<u32>, MailError> {
        let mut reader = self.open_pop3().await?;
        self.authenticate_pop3(&mut reader).await?;
        let response = pop3_command(&mut reader, "LIST").await?;
        let _ = pop3_command(&mut reader, "QUIT").await;
        parse_pop3_list(&response)
    }

    pub async fn pop3_retrieve(&self, message_id: u32) -> Result<String, MailError> {
        let mut reader = self.open_pop3().await?;
        self.authenticate_pop3(&mut reader).await?;
        let response = pop3_command(&mut reader, &format!("RETR {message_id}")).await?;
        let _ = pop3_command(&mut reader, "QUIT").await;
        Ok(response)
    }

    async fn open_pop3(&self) -> Result<MailReader, MailError> {
        let settings = self.pop3.as_ref().ok_or(MailError::Pop3NotConfigured)?;
        if !settings.implicit_tls {
            return Err(MailError::Tls);
        }
        let address = format!("{}:{}", settings.host, settings.port);
        let tcp = timeout(Duration::from_secs(10), TcpStream::connect(address))
            .await
            .map_err(|_| MailError::ConnectionFailed)?
            .map_err(|_| MailError::ConnectionFailed)?;
        let mut reader: MailReader =
            BufReader::new(Box::new(tls_stream(&settings.host, tcp).await?) as BoxMailStream);
        let greeting = read_line(&mut reader).await?;
        if !greeting.starts_with("+OK") {
            return Err(MailError::Rejected);
        }
        Ok(reader)
    }

    async fn authenticate_pop3(&self, reader: &mut MailReader) -> Result<(), MailError> {
        let user = pop3_command(reader, &format!("USER {}", self.username)).await?;
        if !user.starts_with("+OK") {
            return Err(MailError::Rejected);
        }
        let password = pop3_command(reader, &format!("PASS {}", self.password.as_str())).await?;
        if password.starts_with("+OK") {
            Ok(())
        } else {
            Err(MailError::Rejected)
        }
    }
}

async fn tls_stream(host: &str, tcp: TcpStream) -> Result<TlsStream<TcpStream>, MailError> {
    let connector = native_tls::TlsConnector::new().map_err(|_| MailError::Tls)?;
    let connector = TlsConnector::from(connector);
    timeout(Duration::from_secs(10), connector.connect(host, tcp))
        .await
        .map_err(|_| MailError::ConnectionFailed)?
        .map_err(|_| MailError::Tls)
}

async fn read_line(reader: &mut MailReader) -> Result<String, MailError> {
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .map_err(|_| MailError::Io)?;
    if line.is_empty() {
        return Err(MailError::InvalidResponse);
    }
    Ok(line)
}

async fn pop3_command(reader: &mut MailReader, command: &str) -> Result<String, MailError> {
    reader
        .get_mut()
        .write_all(format!("{command}\r\n").as_bytes())
        .await
        .map_err(|_| MailError::Io)?;
    let first = read_line(reader).await?;
    if !first.starts_with("+OK") {
        return Err(MailError::Rejected);
    }
    if matches!(command, "LIST") || command.starts_with("RETR ") {
        let mut body = first;
        loop {
            let line = read_line(reader).await?;
            if line.trim_end() == "." {
                break;
            }
            body.push_str(&line);
        }
        return Ok(body);
    }
    Ok(first)
}

pub fn parse_pop3_list(response: &str) -> Result<Vec<u32>, MailError> {
    let mut ids = Vec::new();
    for line in response.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() || line == "." {
            continue;
        }
        let Some(id) = line
            .split_whitespace()
            .next()
            .and_then(|value| value.parse().ok())
        else {
            return Err(MailError::InvalidResponse);
        };
        ids.push(id);
    }
    Ok(ids)
}
