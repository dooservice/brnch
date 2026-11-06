use std::time::Duration;

use brnch_desktop::AgentDetector;

#[tokio::test]
async fn the_version_is_the_first_line_the_program_prints() {
    let version = AgentDetector::ask_version(
        "sh",
        &["-c", "echo 2.1.0; echo more"],
        Duration::from_secs(2),
    )
    .await;

    assert_eq!(version.as_deref(), Some("2.1.0"));
}

#[tokio::test]
async fn a_missing_failing_or_slow_program_counts_as_not_installed() {
    let limit = Duration::from_millis(300);

    assert_eq!(
        AgentDetector::ask_version("definitely-not-installed-agent", &[], limit).await,
        None
    );
    assert_eq!(
        AgentDetector::ask_version("sh", &["-c", "exit 3"], limit).await,
        None
    );
    assert_eq!(
        AgentDetector::ask_version("sh", &["-c", "sleep 5"], limit).await,
        None
    );
}
