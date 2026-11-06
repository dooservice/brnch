use std::time::Duration;

use brnch_agents::AgentKind;
use serde::Serialize;
use tokio::process::Command;

const ASKING_TIME: Duration = Duration::from_secs(5);

/// Whether an agent is installed on this machine, and which version answered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AgentInstallation {
    pub kind: AgentKind,
    pub installed: bool,
    pub version: Option<String>,
}

/// Asks each agent's own program for its version, which is how brnch knows it is installed.
pub struct AgentDetector;

impl AgentDetector {
    pub async fn detect_all() -> Vec<AgentInstallation> {
        let names: &[&str] = if cfg!(windows) {
            &["claude", "claude.cmd"]
        } else {
            &["claude"]
        };
        let mut version = None;
        for name in names {
            version = Self::ask_version(name, &["--version"], ASKING_TIME).await;
            if version.is_some() {
                break;
            }
        }
        vec![AgentInstallation {
            kind: AgentKind::ClaudeCode,
            installed: version.is_some(),
            version,
        }]
    }

    /// The first line the program prints, or `None` when it is missing, fails or takes too long.
    pub async fn ask_version(program: &str, arguments: &[&str], limit: Duration) -> Option<String> {
        let output = tokio::time::timeout(
            limit,
            Command::new(program)
                .args(arguments)
                .stdin(std::process::Stdio::null())
                .kill_on_drop(true)
                .output(),
        )
        .await
        .ok()?
        .ok()?;
        if !output.status.success() {
            return None;
        }
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .map(|line| line.trim().to_owned())
            .filter(|line| !line.is_empty())
    }
}
