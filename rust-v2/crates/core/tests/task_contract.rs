use qianfu_core::{RetryPolicy, TaskError, TaskKind, TaskRecord, TaskStatus};

#[test]
fn task_key_is_stable_for_idempotent_external_operations() {
    let first = TaskRecord::new(TaskKind::DnsApply, "server-42");
    let second = TaskRecord::new(TaskKind::DnsApply, "server-42");

    assert_eq!(first.idempotency_key(), second.idempotency_key());
    assert_ne!(
        first.idempotency_key(),
        TaskRecord::new(TaskKind::DnsDelete, "server-42").idempotency_key()
    );
}

#[test]
fn failed_task_uses_capped_exponential_retry_delay() {
    let policy = RetryPolicy::new(5, 2, 10);

    assert_eq!(policy.delay_seconds(1), 2);
    assert_eq!(policy.delay_seconds(2), 4);
    assert_eq!(policy.delay_seconds(3), 8);
    assert_eq!(policy.delay_seconds(4), 10);
}

#[test]
fn task_stops_retrying_after_max_attempts() {
    let policy = RetryPolicy::new(2, 1, 30);
    let mut task = TaskRecord::new(TaskKind::SendMail, "mail-7");

    task.claim().unwrap();
    task.fail("SMTP timeout").unwrap();
    assert!(task.can_retry(&policy));

    task.claim().unwrap();
    task.fail("SMTP timeout").unwrap();
    assert!(!task.can_retry(&policy));
}

#[test]
fn task_rejects_invalid_state_transitions() {
    let mut task = TaskRecord::new(TaskKind::ProcessMedia, "asset-9");

    assert_eq!(task.succeed(), Err(TaskError::NotRunning));
    task.claim().unwrap();
    task.succeed().unwrap();
    assert_eq!(task.claim(), Err(TaskError::AlreadyFinished));
    assert_eq!(task.status(), TaskStatus::Succeeded);
}
