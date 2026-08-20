use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};

use thiserror::Error;
use tokio::{
    net::TcpStream,
    time::{Duration, timeout},
};

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ProbeResult {
    pub host: String,
    pub port: u16,
    pub edition: String,
    pub reachable: bool,
}

#[derive(Debug, Error, Eq, PartialEq)]
pub enum ProbeError {
    #[error("server host is invalid")]
    InvalidHost,
    #[error("server probe timed out")]
    Timeout,
    #[error("server connection failed")]
    Connection,
    #[error("private or local probe targets are not allowed")]
    PrivateTarget,
}

pub async fn probe_server(
    host: &str,
    port: u16,
    edition: &str,
    timeout_ms: u64,
) -> Result<ProbeResult, ProbeError> {
    let host = host.trim();
    if host.is_empty() || host.chars().any(char::is_whitespace) || port == 0 {
        return Err(ProbeError::InvalidHost);
    }
    let address = (host, port)
        .to_socket_addrs()
        .map_err(|_| ProbeError::InvalidHost)?
        .next()
        .ok_or(ProbeError::InvalidHost)?;
    if is_private_target(address.ip()) {
        return Err(ProbeError::PrivateTarget);
    }
    timeout(
        Duration::from_millis(timeout_ms.clamp(100, 30_000)),
        TcpStream::connect(address),
    )
    .await
    .map_err(|_| ProbeError::Timeout)?
    .map_err(|_| ProbeError::Connection)?;
    Ok(ProbeResult {
        host: host.to_owned(),
        port,
        edition: edition.to_ascii_lowercase(),
        reachable: true,
    })
}

fn is_private_target(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => is_private_ipv4(address),
        IpAddr::V6(address) => is_private_ipv6(address),
    }
}

fn is_private_ipv4(address: Ipv4Addr) -> bool {
    let octets = address.octets();
    address.is_private()
        || address.is_loopback()
        || address.is_link_local()
        || address.is_unspecified()
        || (octets[0] == 100 && (64..=127).contains(&octets[1]))
        || (octets[0] == 169 && octets[1] == 254)
        || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
        || (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
        || (octets[0] == 198 && (18..=19).contains(&octets[1]))
        || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
        || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
        || octets[0] >= 224
}

fn is_private_ipv6(address: Ipv6Addr) -> bool {
    let segments = address.segments();
    address.is_loopback()
        || address.is_unspecified()
        || address.is_multicast()
        || (segments[0] == 0x2001 && segments[1] == 0x0db8)
        || (segments[0] & 0xfe00 == 0xfc00)
        || (segments[0] & 0xffc0 == 0xfe80)
        || address.to_ipv4().is_some_and(is_private_ipv4)
}
