use crate::{BubblewrapBackend, SandboxBackend, UnavailableBackend, WindowsAccountBackend};
use brnch_core::BrnchResult;
use brnch_core::agent::AgentCommand;

use crate::SandboxProfile;

const WINDOWS_AGENT_ACCOUNT: &str = "brnchagent";

/// Picks the confinement of the system brnch is running on.
pub enum SandboxSelector {
    Bubblewrap(BubblewrapBackend),
    WindowsAccount(WindowsAccountBackend),
    Unavailable(UnavailableBackend),
}

impl SandboxSelector {
    pub fn for_current_system() -> Self {
        if cfg!(target_os = "linux") {
            Self::Bubblewrap(BubblewrapBackend)
        } else if cfg!(target_os = "windows") {
            Self::WindowsAccount(WindowsAccountBackend::new(WINDOWS_AGENT_ACCOUNT))
        } else {
            Self::Unavailable(UnavailableBackend::new(
                "this system has no verified sandbox yet",
            ))
        }
    }
}

impl SandboxBackend for SandboxSelector {
    fn confine(
        &self,
        command: &AgentCommand,
        profile: &SandboxProfile,
    ) -> BrnchResult<AgentCommand> {
        match self {
            Self::Bubblewrap(backend) => backend.confine(command, profile),
            Self::WindowsAccount(backend) => backend.confine(command, profile),
            Self::Unavailable(backend) => backend.confine(command, profile),
        }
    }
}
