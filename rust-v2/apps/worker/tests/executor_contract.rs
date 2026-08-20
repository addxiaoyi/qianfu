use qianfu_core::{RetryPolicy, TaskError, TaskKind, TaskRecord, TaskStatus};
use qianfu_worker::{TaskFuture, TaskHandler, execute_once};

struct SuccessfulHandler;

impl TaskHandler for SuccessfulHandler {
    fn kind(&self) -> TaskKind {
        TaskKind::DnsApply
    }

    fn execute<'a>(&'a self, _task: &'a TaskRecord) -> TaskFuture<'a> {
        Box::pin(async { Ok(()) })
    }
}

struct FailedHandler;

impl TaskHandler for FailedHandler {
    fn kind(&self) -> TaskKind {
        TaskKind::SendMail
    }

    fn execute<'a>(&'a self, _task: &'a TaskRecord) -> TaskFuture<'a> {
        Box::pin(async { Err("provider timeout".to_owned()) })
    }
}

#[tokio::test]
async fn executor_marks_successful_task_complete() {
    let mut task = TaskRecord::new(TaskKind::DnsApply, "server-42");

    execute_once(&mut task, &SuccessfulHandler, &RetryPolicy::new(3, 1, 10))
        .await
        .unwrap();

    assert_eq!(task.status(), TaskStatus::Succeeded);
    assert_eq!(task.attempts, 1);
}

#[tokio::test]
async fn executor_keeps_failed_task_retryable() {
    let mut task = TaskRecord::new(TaskKind::SendMail, "mail-7");

    execute_once(&mut task, &FailedHandler, &RetryPolicy::new(3, 1, 10))
        .await
        .unwrap();

    assert_eq!(task.status(), TaskStatus::Failed);
    assert_eq!(task.last_error.as_deref(), Some("provider timeout"));
    assert_eq!(task.attempts, 1);
}

#[tokio::test]
async fn executor_rejects_handler_for_wrong_task_kind() {
    let mut task = TaskRecord::new(TaskKind::ProcessMedia, "asset-9");

    assert_eq!(
        execute_once(&mut task, &SuccessfulHandler, &RetryPolicy::new(3, 1, 10)).await,
        Err(TaskError::UnsupportedHandler)
    );
    assert_eq!(task.status(), TaskStatus::Pending);
}
