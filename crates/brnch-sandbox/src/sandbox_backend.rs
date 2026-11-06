use brnch_core::BrnchResult;
use brnch_core::agent::AgentCommand;

use crate::SandboxProfile;

/// One operating system's way of confining a process.
pub trait SandboxBackend {
    /// The command to start instead of `command` so the agent runs confined, or an error
    /// when this system cannot confine it.
    fn confine(
        &self,
        command: &AgentCommand,
        profile: &SandboxProfile,
    ) -> BrnchResult<AgentCommand>;
}
