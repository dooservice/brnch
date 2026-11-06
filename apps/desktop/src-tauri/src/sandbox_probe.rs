use std::path::{Path, PathBuf};
use std::sync::Mutex;

use brnch_core::agent::{AgentCommand, AgentOutputLine, AgentOutputListener, AgentRunner};
use serde::Serialize;
use uuid::Uuid;

const SECRET: &str = "brnch-probe-secret";

/// What the probe measured, each check true when the agent was kept to what it should have.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxProbeReport {
    /// A file left in the person's home could not be read by the confined agent.
    pub home_hidden: bool,
    /// The confined agent could still write in its own workspace.
    pub workspace_writable: bool,
    /// Why the probe could not run, such as there being no sandbox.
    pub failure: Option<String>,
}

#[derive(Default)]
struct Collecting {
    text: Mutex<String>,
}

impl AgentOutputListener for Collecting {
    fn received(&self, line: AgentOutputLine) {
        let mut text = self
            .text
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        text.push_str(&line.text);
        text.push('\n');
    }
}

/// Measures, with a real confined process, what an agent can reach. A file with a known secret
/// is left in the person's home, the confined program tries to read it and its answer is judged.
pub struct SandboxProbe;

impl SandboxProbe {
    pub async fn run<Runner: AgentRunner + Sync>(
        runner: &Runner,
        home: &Path,
    ) -> SandboxProbeReport {
        let canary = home.join(format!("brnch-probe-{}.txt", Uuid::new_v4()));
        let workspace: PathBuf =
            std::env::temp_dir().join(format!("brnch-probe-{}", Uuid::new_v4()));
        let prepared =
            std::fs::create_dir_all(&workspace).and_then(|()| std::fs::write(&canary, SECRET));
        let report = match prepared {
            Err(failure) => Self::failed(&failure.to_string()),
            Ok(()) => Self::measure(runner, &canary, &workspace).await,
        };
        let _ = std::fs::remove_file(&canary);
        let _ = std::fs::remove_dir_all(&workspace);
        report
    }

    async fn measure<Runner: AgentRunner + Sync>(
        runner: &Runner,
        canary: &Path,
        workspace: &Path,
    ) -> SandboxProbeReport {
        let directory = workspace.to_string_lossy().into_owned();
        let reading = Collecting::default();
        if let Err(failure) = runner
            .run(&Self::read_command(canary), &directory, &reading)
            .await
        {
            return Self::failed(&failure.to_string());
        }
        let home_hidden = !reading
            .text
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .contains(SECRET);
        let writing = Collecting::default();
        let written = workspace.join("probe-written.txt");
        let workspace_writable = runner
            .run(&Self::write_command(&written), &directory, &writing)
            .await
            .is_ok()
            && written.is_file();
        SandboxProbeReport {
            home_hidden,
            workspace_writable,
            failure: None,
        }
    }

    fn failed(reason: &str) -> SandboxProbeReport {
        SandboxProbeReport {
            home_hidden: false,
            workspace_writable: false,
            failure: Some(reason.to_owned()),
        }
    }

    fn read_command(path: &Path) -> AgentCommand {
        if cfg!(windows) {
            Self::powershell(&format!("Get-Content -LiteralPath '{}'", path.display()))
        } else {
            AgentCommand {
                program: "cat".to_owned(),
                arguments: vec![path.to_string_lossy().into_owned()],
            }
        }
    }

    fn write_command(path: &Path) -> AgentCommand {
        if cfg!(windows) {
            Self::powershell(&format!(
                "Set-Content -LiteralPath '{}' -Value ok",
                path.display()
            ))
        } else {
            AgentCommand {
                program: "sh".to_owned(),
                arguments: vec!["-c".to_owned(), format!("echo ok > '{}'", path.display())],
            }
        }
    }

    fn powershell(script: &str) -> AgentCommand {
        AgentCommand {
            program: "powershell.exe".to_owned(),
            arguments: vec![
                "-NoProfile".to_owned(),
                "-Command".to_owned(),
                script.to_owned(),
            ],
        }
    }
}
