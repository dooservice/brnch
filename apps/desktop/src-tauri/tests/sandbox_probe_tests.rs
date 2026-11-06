#![cfg(unix)]
use brnch_core::BrnchResult;
use brnch_core::agent::{AgentCommand, AgentOutcome, AgentOutputListener, AgentRunner};
use brnch_desktop::SandboxProbe;
use brnch_process::ProcessAgentRunner;

/// A runner that hides the person's files: reading anything fails, writing works as usual.
struct HidingRunner(ProcessAgentRunner);

impl AgentRunner for HidingRunner {
    async fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> BrnchResult<AgentOutcome> {
        if command.program == "cat" {
            return Ok(AgentOutcome { exit_code: Some(1) });
        }
        self.0.run(command, directory, listener).await
    }
}

#[tokio::test]
async fn with_no_confinement_the_probe_sees_that_the_home_is_readable() {
    let home = std::env::temp_dir();

    let report = SandboxProbe::run(&ProcessAgentRunner::new(&[]), &home).await;

    assert!(!report.home_hidden);
    assert!(report.workspace_writable);
    assert_eq!(report.failure, None);
}

#[tokio::test]
async fn a_runner_that_hides_the_home_is_measured_as_hiding_it() {
    let home = std::env::temp_dir();

    let report = SandboxProbe::run(&HidingRunner(ProcessAgentRunner::new(&[])), &home).await;

    assert!(report.home_hidden);
    assert!(report.workspace_writable);
}
