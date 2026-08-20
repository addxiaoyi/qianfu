use chrono::{Duration, Utc};
use qianfu_worker::retry_at;

#[test]
fn retry_schedule_uses_attempt_number_and_caps_delay() {
    let now = Utc::now();
    let first = retry_at(now, 1);
    let fourth = retry_at(now, 4);

    assert!(first >= now + Duration::seconds(2));
    assert!(fourth <= now + Duration::seconds(30));
    assert!(fourth > first);
}
