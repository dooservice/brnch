use std::fs;
use std::path::{Path, PathBuf};

use brnch_core::agent::AgentCommand;
use brnch_core::{BrnchError, BrnchResult};
use serde::Serialize;
use uuid::Uuid;

use crate::{SandboxBackend, SandboxProfile};

const SETUP_SCRIPT: &str = include_str!("../windows/setup-agent-account.ps1");
const RUN_SCRIPT: &str = include_str!("../windows/run-as-agent.ps1");
const JOB_SCRIPT: &str = include_str!("../windows/agent-job.ps1");
const ENVIRONMENT_SCRIPT: &str = include_str!("../windows/save-agent-environment.ps1");
const READY_MARKER: &str = "agent-account.ready";
const JOBS_DIRECTORY: &str = "agent-jobs";
const POWERSHELL: &str = "powershell.exe";

/// What the account's job file tells the inner script to start.
#[derive(Serialize)]
struct Job<'job> {
    program: &'job str,
    arguments: &'job [String],
    directory: &'job str,
}

/// Windows: the agent runs as a separate local account that cannot read the person's profile,
/// keys or credential store. The person's own process starts it, so nothing secret is handed over
/// except what the agent needs: its workspace, its program's folder and, if set, its API key.
#[derive(Debug, Clone)]
pub struct WindowsAccountBackend {
    account_name: String,
    data_directory: PathBuf,
}

impl WindowsAccountBackend {
    pub fn new(account_name: &str, data_directory: &Path) -> Self {
        Self {
            account_name: account_name.to_owned(),
            data_directory: data_directory.to_path_buf(),
        }
    }

    /// Whether the account was set up: the setup leaves a marker when it succeeds.
    pub fn is_ready(&self) -> bool {
        self.data_directory.join(READY_MARKER).is_file()
    }

    /// Writes the scripts next to the data and returns the folder that holds them.
    pub fn install_scripts(&self) -> BrnchResult<PathBuf> {
        let scripts = self.data_directory.join("scripts");
        fs::create_dir_all(&scripts).map_err(Self::failure)?;
        for (name, text) in [
            ("setup-agent-account.ps1", SETUP_SCRIPT),
            ("run-as-agent.ps1", RUN_SCRIPT),
            ("agent-job.ps1", JOB_SCRIPT),
            ("save-agent-environment.ps1", ENVIRONMENT_SCRIPT),
        ] {
            fs::write(scripts.join(name), text).map_err(Self::failure)?;
        }
        Ok(scripts)
    }

    /// The commands that set the account up, in the order to run them. The second one is the only
    /// one that needs administrator permission; with `elevate` it asks for it through Windows.
    pub fn setup_commands(&self, elevate: bool) -> Vec<AgentCommand> {
        let script = self.script("setup-agent-account.ps1");
        let phase = |name: &str| self.phase_arguments(&script, name);
        let prepare = AgentCommand {
            program: POWERSHELL.to_owned(),
            arguments: phase("Prepare"),
        };
        let create = if elevate {
            let quoted: Vec<String> = phase("Create")
                .iter()
                .map(|argument| format!("'\"{}\"'", argument.replace('\'', "''")))
                .collect();
            AgentCommand {
                program: POWERSHELL.to_owned(),
                arguments: vec![
                    "-NoProfile".to_owned(),
                    "-Command".to_owned(),
                    format!(
                        "Start-Process {POWERSHELL} -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList {}",
                        quoted.join(",")
                    ),
                ],
            }
        } else {
            AgentCommand {
                program: POWERSHELL.to_owned(),
                arguments: phase("Create"),
            }
        };
        vec![prepare, create]
    }

    /// The command that keeps the variables agents receive, and the name of the environment
    /// variable that carries them (as JSON) so they never travel on a command line.
    pub fn environment_command(&self, clear: bool) -> (AgentCommand, &'static str) {
        let mut arguments = vec![
            "-NoProfile".to_owned(),
            "-ExecutionPolicy".to_owned(),
            "Bypass".to_owned(),
            "-File".to_owned(),
            self.script("save-agent-environment.ps1"),
            "-DataDirectory".to_owned(),
            self.data_directory.to_string_lossy().into_owned(),
        ];
        if clear {
            arguments.push("-Clear".to_owned());
        }
        (
            AgentCommand {
                program: POWERSHELL.to_owned(),
                arguments,
            },
            "BRNCH_AGENT_ENVIRONMENT",
        )
    }

    fn phase_arguments(&self, script: &str, phase: &str) -> Vec<String> {
        vec![
            "-NoProfile".to_owned(),
            "-ExecutionPolicy".to_owned(),
            "Bypass".to_owned(),
            "-File".to_owned(),
            script.to_owned(),
            "-Phase".to_owned(),
            phase.to_owned(),
            "-Account".to_owned(),
            self.account_name.clone(),
            "-DataDirectory".to_owned(),
            self.data_directory.to_string_lossy().into_owned(),
        ]
    }

    fn script(&self, name: &str) -> String {
        self.data_directory
            .join("scripts")
            .join(name)
            .to_string_lossy()
            .into_owned()
    }

    // Taken by value so it can be passed straight to `map_err`.
    #[allow(clippy::needless_pass_by_value)]
    fn failure(error: std::io::Error) -> BrnchError {
        BrnchError::SandboxUnavailable(error.to_string())
    }
}

impl SandboxBackend for WindowsAccountBackend {
    fn confine(
        &self,
        command: &AgentCommand,
        profile: &SandboxProfile,
    ) -> BrnchResult<AgentCommand> {
        if !self.is_ready() {
            return Err(BrnchError::SandboxUnavailable(
                "the account agents run under has not been set up yet".to_owned(),
            ));
        }
        self.install_scripts()?;
        let jobs = self.data_directory.join(JOBS_DIRECTORY);
        fs::create_dir_all(&jobs).map_err(Self::failure)?;
        let job_file = jobs.join(format!("{}.json", Uuid::new_v4()));
        let job = Job {
            program: &command.program,
            arguments: &command.arguments,
            directory: &profile.workspace_directory,
        };
        let text = serde_json::to_string(&job)
            .map_err(|failure| BrnchError::SandboxUnavailable(failure.to_string()))?;
        fs::write(&job_file, text).map_err(Self::failure)?;
        Ok(AgentCommand {
            program: POWERSHELL.to_owned(),
            arguments: vec![
                "-NoProfile".to_owned(),
                "-NonInteractive".to_owned(),
                "-ExecutionPolicy".to_owned(),
                "Bypass".to_owned(),
                "-File".to_owned(),
                self.script("run-as-agent.ps1"),
                "-Account".to_owned(),
                self.account_name.clone(),
                "-DataDirectory".to_owned(),
                self.data_directory.to_string_lossy().into_owned(),
                "-JobFile".to_owned(),
                job_file.to_string_lossy().into_owned(),
                "-InnerScript".to_owned(),
                self.script("agent-job.ps1"),
                "-WorkspaceDirectory".to_owned(),
                profile.workspace_directory.clone(),
            ],
        })
    }
}
