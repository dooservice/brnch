use brnch_core::BrnchResult;
use brnch_core::agent::{AgentCommand, AgentOutcome, AgentOutputListener, AgentRunner};

use crate::{SandboxBackend, SandboxProfile};

/// Wraps another runner so every agent it starts is confined first. If the sandbox says no,
/// the agent is not started.
pub struct SandboxedAgentRunner<Runner, Backend> {
    runner: Runner,
    backend: Backend,
    read_only_directories: Vec<String>,
}

impl<Runner, Backend> SandboxedAgentRunner<Runner, Backend> {
    pub fn new(runner: Runner, backend: Backend, read_only_directories: &[&str]) -> Self {
        Self {
            runner,
            backend,
            read_only_directories: read_only_directories
                .iter()
                .map(|directory| (*directory).to_owned())
                .collect(),
        }
    }
}

impl<Runner, Backend> AgentRunner for SandboxedAgentRunner<Runner, Backend>
where
    Runner: AgentRunner + Sync,
    Backend: SandboxBackend + Sync,
{
    async fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> BrnchResult<AgentOutcome> {
        let profile = SandboxProfile {
            workspace_directory: directory.to_owned(),
            read_only_directories: self.read_only_directories.clone(),
        };
        let confined = self.backend.confine(command, &profile)?;
        self.runner.run(&confined, directory, listener).await
    }
}
