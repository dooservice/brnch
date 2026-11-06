use std::sync::{Arc, Mutex};

use brnch_core::agent::{
    AgentCommand, AgentOutcome, AgentOutputLine, AgentOutputListener, AgentRunner,
};
use brnch_core::{BrnchError, BrnchResult};
use brnch_sandbox::{
    BubblewrapBackend, SandboxBackend, SandboxProfile, SandboxedAgentRunner, UnavailableBackend,
};

fn profile() -> SandboxProfile {
    SandboxProfile {
        workspace_directory: "/work/agent-1".to_owned(),
        read_only_directories: vec!["/pool".to_owned()],
    }
}

fn command() -> AgentCommand {
    AgentCommand {
        program: "claude".to_owned(),
        arguments: vec!["--print".to_owned(), "fix it".to_owned()],
    }
}

#[test]
fn bubblewrap_exposes_only_the_system_the_workspace_and_what_the_profile_adds() {
    let confined = BubblewrapBackend.confine(&command(), &profile()).unwrap();

    assert_eq!(confined.program, "bwrap");
    let arguments = confined.arguments.join(" ");
    assert!(arguments.contains("--ro-bind /usr /usr"));
    assert!(arguments.contains("--ro-bind /pool /pool"));
    assert!(arguments.contains("--bind /work/agent-1 /work/agent-1"));
    assert!(arguments.contains("--setenv HOME /nonexistent"));
    assert!(arguments.contains("--unshare-pid --die-with-parent"));
    assert!(arguments.ends_with("claude --print fix it"));
}

#[test]
fn bubblewrap_never_binds_a_home_directory() {
    let confined = BubblewrapBackend.confine(&command(), &profile()).unwrap();

    assert!(
        !confined
            .arguments
            .iter()
            .any(|argument| argument.contains("/home"))
    );
}

#[test]
fn the_unavailable_backend_refuses_every_agent() {
    let backend = UnavailableBackend::new("no sandbox here");

    assert!(matches!(
        backend.confine(&command(), &profile()),
        Err(BrnchError::SandboxUnavailable(reason)) if reason == "no sandbox here"
    ));
}

#[derive(Default, Clone)]
struct StartedCommands {
    commands: Arc<Mutex<Vec<AgentCommand>>>,
}

impl AgentRunner for StartedCommands {
    fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> impl Future<Output = BrnchResult<AgentOutcome>> + Send {
        listener.received(AgentOutputLine {
            stream: brnch_core::agent::OutputStream::Standard,
            text: directory.to_owned(),
        });
        self.commands.lock().unwrap().push(command.clone());
        std::future::ready(Ok(AgentOutcome { exit_code: Some(0) }))
    }
}

struct IgnoringListener;

impl AgentOutputListener for IgnoringListener {
    fn received(&self, line: AgentOutputLine) {
        let _ = line;
    }
}

#[tokio::test]
async fn an_agent_is_never_started_when_the_sandbox_refuses() {
    let started = StartedCommands::default();
    let runner = SandboxedAgentRunner::new(started.clone(), UnavailableBackend::new("no"), &[]);

    let result = runner
        .run(&command(), "/work/agent-1", &IgnoringListener)
        .await;

    assert!(matches!(result, Err(BrnchError::SandboxUnavailable(_))));
    assert_eq!(started.commands.lock().unwrap().len(), 0);
}

#[tokio::test]
async fn the_wrapped_runner_starts_the_confined_command() {
    let started = StartedCommands::default();
    let runner = SandboxedAgentRunner::new(started.clone(), BubblewrapBackend, &["/pool"]);

    runner
        .run(&command(), "/work/agent-1", &IgnoringListener)
        .await
        .unwrap();

    assert_eq!(started.commands.lock().unwrap()[0].program, "bwrap");
}

mod selection {
    use std::ffi::OsString;

    use brnch_sandbox::SandboxSelector;

    #[test]
    fn linux_is_confined_only_when_bubblewrap_is_installed() {
        let directory = std::env::temp_dir().join(format!("brnch-path-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(directory.join("bwrap"), "").unwrap();
        let with_bwrap = OsString::from(&directory);

        assert!(
            SandboxSelector::for_system("linux", Some(&with_bwrap), std::path::Path::new("."))
                .status()
                .available
        );
        let nowhere = OsString::from("/nonexistent");
        let without =
            SandboxSelector::for_system("linux", Some(&nowhere), std::path::Path::new("."));
        assert!(!without.status().available);
        assert!(without.status().reason.unwrap().contains("not installed"));
        std::fs::remove_dir_all(&directory).unwrap();
    }

    #[test]
    fn windows_is_confined_only_after_its_account_was_set_up_and_unknown_systems_never() {
        let data = std::env::temp_dir().join(format!("brnch-win-{}", std::process::id()));
        std::fs::create_dir_all(&data).unwrap();
        let before = SandboxSelector::for_system("windows", None, &data).status();
        std::fs::write(data.join("agent-account.ready"), "brnchagent").unwrap();
        let after = SandboxSelector::for_system("windows", None, &data).status();
        let other = SandboxSelector::for_system("freebsd", None, &data).status();

        assert!(!before.available);
        assert!(before.reason.unwrap().contains("not been set up"));
        assert!(after.available);
        assert!(!other.available);
        std::fs::remove_dir_all(&data).unwrap();
    }
}

mod windows_account {
    use std::path::PathBuf;

    use brnch_core::BrnchError;
    use brnch_core::agent::AgentCommand;
    use brnch_sandbox::{SandboxBackend, SandboxProfile, WindowsAccountBackend};

    fn data_directory(name: &str) -> PathBuf {
        let directory =
            std::env::temp_dir().join(format!("brnch-win-{name}-{}", std::process::id()));
        std::fs::create_dir_all(directory.join("agent-jobs")).unwrap();
        directory
    }

    fn profile() -> SandboxProfile {
        SandboxProfile {
            workspace_directory: "D:\\work\\agent-1".to_owned(),
            read_only_directories: Vec::new(),
        }
    }

    fn command() -> AgentCommand {
        AgentCommand {
            program: "claude".to_owned(),
            arguments: vec!["--print".to_owned(), "say \"hi\"".to_owned()],
        }
    }

    #[test]
    fn it_refuses_to_start_an_agent_until_the_account_exists() {
        let data = data_directory("refuse");
        let backend = WindowsAccountBackend::new("brnchagent", &data);

        let result = backend.confine(&command(), &profile());

        assert!(
            matches!(result, Err(BrnchError::SandboxUnavailable(reason)) if reason.contains("not been set up"))
        );
        std::fs::remove_dir_all(&data).unwrap();
    }

    #[test]
    fn a_ready_account_starts_the_agent_through_the_runner_script_with_the_job_in_a_file() {
        let data = data_directory("ready");
        std::fs::write(data.join("agent-account.ready"), "brnchagent").unwrap();
        let backend = WindowsAccountBackend::new("brnchagent", &data);

        let confined = backend.confine(&command(), &profile()).unwrap();

        assert_eq!(confined.program, "powershell.exe");
        let argument = |name: &str| {
            let at = confined
                .arguments
                .iter()
                .position(|candidate| candidate == name)
                .unwrap();
            confined.arguments[at + 1].clone()
        };
        assert!(argument("-File").ends_with("run-as-agent.ps1"));
        assert_eq!(argument("-Account"), "brnchagent");
        assert_eq!(argument("-WorkspaceDirectory"), "D:\\work\\agent-1");
        let job: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(argument("-JobFile")).unwrap()).unwrap();
        assert_eq!(job["program"], "claude");
        assert_eq!(job["arguments"][1], "say \"hi\"");
        assert_eq!(job["directory"], "D:\\work\\agent-1");
        assert!(!confined.arguments.join(" ").contains("say"));
        std::fs::remove_dir_all(&data).unwrap();
    }

    #[test]
    fn setup_runs_in_two_steps_and_only_the_second_asks_for_administrator_permission() {
        let data = data_directory("setup");
        let backend = WindowsAccountBackend::new("brnchagent", &data);
        let scripts = backend.install_scripts().unwrap();

        let steps = backend.setup_commands(true);
        let direct = backend.setup_commands(false);

        assert!(scripts.join("run-as-agent.ps1").is_file());
        assert!(steps[0].arguments.join(" ").contains("-Phase Prepare"));
        assert!(!steps[0].arguments.join(" ").contains("RunAs"));
        assert!(steps[1].arguments.join(" ").contains("-Verb RunAs"));
        assert!(steps[1].arguments.join(" ").contains("Create"));
        assert!(direct[1].arguments.join(" ").contains("-Phase Create"));
        assert!(!direct[1].arguments.join(" ").contains("RunAs"));
        std::fs::remove_dir_all(&data).unwrap();
    }

    #[test]
    fn the_api_key_travels_in_an_environment_variable_and_never_on_the_command_line() {
        let data = data_directory("environment");
        let backend = WindowsAccountBackend::new("brnchagent", &data);

        let (command, variable) = backend.environment_command(false);
        let (clearing, _) = backend.environment_command(true);

        assert_eq!(variable, "BRNCH_AGENT_ENVIRONMENT");
        assert!(!command.arguments.join(" ").contains("sk-"));
        assert!(clearing.arguments.contains(&"-Clear".to_owned()));
        std::fs::remove_dir_all(&data).unwrap();
    }
}
