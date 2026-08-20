use qianfu_core::AppConfig;
use qianfu_storage::PgStorage;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = AppConfig::from_env()?;
    let storage = PgStorage::connect(config.database_url.as_str(), 5).await?;
    storage.migrate().await?;
    let mut shutdown = Box::pin(tokio::signal::ctrl_c());
    let mut lease_check = tokio::time::interval(std::time::Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            _ = lease_check.tick() => {
                let _ = storage.reclaim_stale_tasks(300).await?;
            }
            task = storage.claim_next_task(5) => {
                match task? {
                    Some(task) => {
                        if let Err(error) = qianfu_worker::process_task(&storage, &task, &config).await {
                            let retry_at = qianfu_worker::retry_at(chrono::Utc::now(), task.attempts);
                            if let Err(storage_error) = storage.fail_task(task.id, &error, retry_at).await {
                                eprintln!("failed to persist task {} failure: {storage_error}", task.id);
                            }
                        }
                    }
                    None => tokio::time::sleep(std::time::Duration::from_secs(1)).await,
                }
            }
        }
    }
    Ok(())
}
