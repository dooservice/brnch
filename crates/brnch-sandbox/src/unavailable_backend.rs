use brnch_core::agent::AgentCommand;
use brnch_core::{BrnchError, BrnchResult};

use crate::{SandboxBackend, SandboxProfile};

/// Stands in where no sandbox exists. It never lets the agent start.
#[derive(Debug, Clone)]
pub struct UnavailableBackend {
    reason: String,
}

impl UnavailableBackend {
    pub fn new(reason: &str) -> Self {
        Self {
            reason: reason.to_owned(),
        }
    }
}

impl SandboxBackend for UnavailableBackend {
    fn confine(&self, _: &AgentCommand, _: &SandboxProfile) -> BrnchResult<AgentCommand> {
        Err(BrnchError::SandboxUnavailable(self.reason.clone()))
    }
}
