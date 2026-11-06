use brnch_core::agent::AgentCommand;
use brnch_core::{BrnchError, BrnchResult};

use crate::{SandboxBackend, SandboxProfile};

/// Windows: the agent runs as a separate local account that has no access to the person's
/// profile. The permission grants are ready; starting the process under that account is not
/// built yet, so this backend refuses until it has been checked on a real Windows PC.
#[derive(Debug, Clone)]
pub struct WindowsAccountBackend {
    account_name: String,
}

impl WindowsAccountBackend {
    pub fn new(account_name: &str) -> Self {
        Self {
            account_name: account_name.to_owned(),
        }
    }

    /// The `icacls` calls that give the account the workspace and nothing else. Run them on
    /// the workspace root before gitd fills it so new files inherit the permission.
    pub fn permission_grants(&self, profile: &SandboxProfile) -> Vec<AgentCommand> {
        let modify_workspace = Self::grant(
            &profile.workspace_directory,
            &format!("{}:(OI)(CI)M", self.account_name),
        );
        let read_only = profile
            .read_only_directories
            .iter()
            .map(|directory| Self::grant(directory, &format!("{}:(OI)(CI)RX", self.account_name)));
        std::iter::once(modify_workspace).chain(read_only).collect()
    }

    fn grant(directory: &str, permission: &str) -> AgentCommand {
        AgentCommand {
            program: "icacls".to_owned(),
            arguments: vec![
                directory.to_owned(),
                "/grant".to_owned(),
                permission.to_owned(),
            ],
        }
    }
}

impl SandboxBackend for WindowsAccountBackend {
    fn confine(&self, _: &AgentCommand, _: &SandboxProfile) -> BrnchResult<AgentCommand> {
        Err(BrnchError::SandboxUnavailable(
            "starting an agent under the dedicated Windows account is not verified yet".to_owned(),
        ))
    }
}
