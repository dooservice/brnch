use brnch_process::HiddenWindow;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use brnch_core::{BrnchError, BrnchResult};
use brnch_sandbox::{SandboxSelector, SandboxStatus};

const API_KEY_VARIABLE: &str = "ANTHROPIC_API_KEY";

/// Sets up the account Windows agents run under, and keeps the API key they are given. Everything
/// here is a command the person's own session runs; the only elevated one asks Windows for permission.
#[derive(Clone)]
pub struct AgentAccount {
    data_directory: PathBuf,
}

impl AgentAccount {
    pub fn new(data_directory: &Path) -> Self {
        Self {
            data_directory: data_directory.to_path_buf(),
        }
    }

    /// Makes the account and shows the result. Blocks until the person answers Windows' question.
    pub fn set_up(&self) -> BrnchResult<SandboxStatus> {
        let selector = SandboxSelector::for_current_system(&self.data_directory);
        let backend = selector.windows_backend().ok_or_else(|| {
            BrnchError::SandboxUnavailable(
                "the dedicated account exists only on Windows".to_owned(),
            )
        })?;
        backend.install_scripts()?;
        for command in backend.setup_commands(true) {
            let status = Command::new(&command.program)
                .args(&command.arguments)
                .stdin(Stdio::null())
                .hidden_window()
                .status()
                .map_err(|failure| BrnchError::SandboxUnavailable(failure.to_string()))?;
            if !status.success() {
                return Err(BrnchError::SandboxUnavailable(
                    "setting up the account failed or was not allowed".to_owned(),
                ));
            }
        }
        Ok(SandboxSelector::for_current_system(&self.data_directory).status())
    }

    /// Keeps (or, with `None`, forgets) the API key agents receive in their environment.
    pub fn set_api_key(&self, api_key: Option<&str>) -> BrnchResult<()> {
        let selector = SandboxSelector::for_current_system(&self.data_directory);
        let backend = selector.windows_backend().ok_or_else(|| {
            BrnchError::SandboxUnavailable(
                "agents receive their API key through the Windows account".to_owned(),
            )
        })?;
        backend.install_scripts()?;
        let (command, variable) = backend.environment_command(api_key.is_none());
        let mut process = Command::new(&command.program);
        process
            .args(&command.arguments)
            .stdin(Stdio::null())
            .hidden_window();
        if let Some(key) = api_key {
            let json = serde_json::json!({ API_KEY_VARIABLE: key }).to_string();
            process.env(variable, json);
        }
        let status = process
            .status()
            .map_err(|failure| BrnchError::SandboxUnavailable(failure.to_string()))?;
        if status.success() {
            Ok(())
        } else {
            Err(BrnchError::SandboxUnavailable(
                "the API key could not be kept".to_owned(),
            ))
        }
    }
}
