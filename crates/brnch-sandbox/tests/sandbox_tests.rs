use std::sync::{Arc, Mutex};

use brnch_core::agent::{
    AgentCommand, AgentOutcome, AgentOutputLine, AgentOutputListener, AgentRunner,
};
use brnch_core::{BrnchError, BrnchResult};
use brnch_sandbox::{
    BubblewrapBackend, SandboxBackend, SandboxProfile, SandboxedAgentRunner, UnavailableBackend,
    WindowsAccountBackend,
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

#[test]
fn the_windows_backend_refuses_until_it_is_verified_but_has_its_grants_ready() {
    let backend = WindowsAccountBackend::new("brnchagent");

    assert!(matches!(
        backend.confine(&command(), &profile()),
        Err(BrnchError::SandboxUnavailable(_))
    ));
    let grants = backend.permission_grants(&profile());
    assert_eq!(
        grants[0].arguments,
        ["/work/agent-1", "/grant", "brnchagent:(OI)(CI)M"]
    );
    assert_eq!(
        grants[1].arguments,
        ["/pool", "/grant", "brnchagent:(OI)(CI)RX"]
    );
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
            SandboxSelector::for_system("linux", Some(&with_bwrap))
                .status()
                .available
        );
        let nowhere = OsString::from("/nonexistent");
        let without = SandboxSelector::for_system("linux", Some(&nowhere));
        assert!(!without.status().available);
        assert!(without.status().reason.unwrap().contains("not installed"));
        std::fs::remove_dir_all(&directory).unwrap();
    }

    #[test]
    fn windows_and_unknown_systems_report_why_nothing_confines_the_agent() {
        let windows = SandboxSelector::for_system("windows", None).status();
        let other = SandboxSelector::for_system("freebsd", None).status();

        assert!(!windows.available);
        assert!(windows.reason.unwrap().contains("not verified"));
        assert!(!other.available);
    }
}
