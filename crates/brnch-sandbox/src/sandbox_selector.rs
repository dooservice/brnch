use std::ffi::OsString;
use std::path::Path;

use brnch_core::BrnchResult;
use brnch_core::agent::AgentCommand;

use crate::{
    BubblewrapBackend, SandboxBackend, SandboxProfile, SandboxStatus, UnavailableBackend,
    WindowsAccountBackend,
};

const WINDOWS_AGENT_ACCOUNT: &str = "brnchagent";
const BUBBLEWRAP_PROGRAM: &str = "bwrap";

/// Picks the confinement of the system brnch is running on.
pub enum SandboxSelector {
    Bubblewrap(BubblewrapBackend),
    WindowsAccount(WindowsAccountBackend),
    Unavailable(UnavailableBackend, String),
}

impl SandboxSelector {
    /// `data_directory` is where the application keeps what the Windows account needs.
    pub fn for_current_system(data_directory: &Path) -> Self {
        Self::for_system(
            std::env::consts::OS,
            std::env::var_os("PATH").as_ref(),
            data_directory,
        )
    }

    /// `operating_system` is a value of [`std::env::consts::OS`].
    pub fn for_system(
        operating_system: &str,
        path_variable: Option<&OsString>,
        data_directory: &Path,
    ) -> Self {
        match operating_system {
            "linux" if Self::is_installed(BUBBLEWRAP_PROGRAM, path_variable) => {
                Self::Bubblewrap(BubblewrapBackend)
            }
            "linux" => Self::unavailable("bubblewrap (bwrap) is not installed"),
            "windows" => Self::WindowsAccount(WindowsAccountBackend::new(
                WINDOWS_AGENT_ACCOUNT,
                data_directory,
            )),
            _ => Self::unavailable("this system has no verified sandbox yet"),
        }
    }

    pub fn status(&self) -> SandboxStatus {
        match self {
            Self::Bubblewrap(_) => SandboxStatus {
                available: true,
                mechanism: "bubblewrap".to_owned(),
                reason: None,
            },
            Self::WindowsAccount(backend) => SandboxStatus {
                available: backend.is_ready(),
                mechanism: "dedicated Windows account".to_owned(),
                reason: (!backend.is_ready())
                    .then(|| "the account agents run under has not been set up yet".to_owned()),
            },
            Self::Unavailable(_, reason) => SandboxStatus {
                available: false,
                mechanism: "none".to_owned(),
                reason: Some(reason.clone()),
            },
        }
    }

    pub fn windows_backend(&self) -> Option<&WindowsAccountBackend> {
        match self {
            Self::WindowsAccount(backend) => Some(backend),
            _ => None,
        }
    }

    fn unavailable(reason: &str) -> Self {
        Self::Unavailable(UnavailableBackend::new(reason), reason.to_owned())
    }

    fn is_installed(program: &str, path_variable: Option<&OsString>) -> bool {
        path_variable.is_some_and(|paths| {
            std::env::split_paths(paths)
                .any(|directory| Path::new(&directory).join(program).is_file())
        })
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
            Self::Unavailable(backend, _) => backend.confine(command, profile),
        }
    }
}
