use std::{env, net::SocketAddr};

use qianfu_core::AppConfig;
use qianfu_storage::PgStorage;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _config = AppConfig::from_env()?;
    let storage = PgStorage::connect(_config.database_url.as_str(), 10).await?;
    storage.migrate().await?;
    let address = env::var("QF_API_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:3100".to_string())
        .parse::<SocketAddr>()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(
        listener,
        qianfu_api::router_with_storage_and_config(storage, _config),
    )
    .await?;
    Ok(())
}
