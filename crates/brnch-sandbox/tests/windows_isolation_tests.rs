//! Runs on a real Windows machine (the "CI" workflow does it on a GitHub runner, which is an
//! administrator without a permission prompt). It sets the dedicated account up, starts a stand-in
//! agent through the same code brnch uses, and checks what that agent can and cannot reach.
#![cfg(windows)]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use brnch_core::agent::{
    AgentCommand, AgentOutputLine, AgentOutputListener, AgentRunner, OutputStream,
};
use brnch_process::ProcessAgentRunner;
use brnch_sandbox::{SandboxedAgentRunner, WindowsAccountBackend};

const ACCOUNT: &str = "brnchagent";

#[derive(Default)]
struct Collecting {
    lines: Mutex<Vec<AgentOutputLine>>,
}

impl AgentOutputListener for Collecting {
    fn received(&self, line: AgentOutputLine) {
        self.lines.lock().unwrap().push(line);
    }
}

fn run(command: &AgentCommand) {
    let status = Command::new(&command.program)
        .args(&command.arguments)
        .status()
        .expect("the command starts");
    assert!(status.success(), "{command:?} failed");
}

fn output_of(collected: &Collecting, stream: OutputStream) -> String {
    collected
        .lines
        .lock()
        .unwrap()
        .iter()
        .filter(|line| line.stream == stream)
        .map(|line| line.text.clone())
        .collect::<Vec<_>>()
        .join("\n")
}

/// What the stand-in agent does: says who it is, whether it got the key, whether it can read a
/// canary file in the real person's profile, writes in its workspace, prints to both channels.
fn stand_in_agent(canary: &Path, workspace: &Path) -> AgentCommand {
    let script = format!(
        "whoami; \
         Write-Output ('KEY=' + $env:ANTHROPIC_API_KEY); \
         try {{ Get-Content -LiteralPath '{canary}' -ErrorAction Stop | Out-Null; Write-Output 'CANARY=readable' }} catch {{ Write-Output 'CANARY=blocked' }}; \
         Set-Content -LiteralPath '{written}' -Value 'quoted \"text\"'; Write-Output 'WROTE'; \
         [Console]::Error.WriteLine('to-standard-error'); exit 7",
        canary = canary.display(),
        written = workspace.join("written.txt").display(),
    );
    AgentCommand {
        program: "powershell.exe".to_owned(),
        arguments: vec!["-NoProfile".to_owned(), "-Command".to_owned(), script],
    }
}

fn cleanup(data: &Path, workspace: &Path, canary: &Path) {
    let _ = Command::new("net.exe")
        .args(["user", ACCOUNT, "/delete"])
        .status();
    let _ = std::fs::remove_file(canary);
    let _ = std::fs::remove_dir_all(data);
    let _ = std::fs::remove_dir_all(workspace);
}

#[tokio::test]
#[ignore = "needs Windows and administrator permission; the CI workflow runs it"]
async fn an_agent_in_the_dedicated_account_cannot_read_the_persons_files_and_still_works() {
    let identifier = std::process::id();
    let data = PathBuf::from(format!("C:\\brnch-ci-data-{identifier}"));
    let workspace = PathBuf::from(format!("C:\\brnch-ci-workspace-{identifier}"));
    let profile = PathBuf::from(std::env::var("USERPROFILE").expect("a profile"));
    let canary = profile.join(format!("brnch-canary-{identifier}.txt"));
    std::fs::create_dir_all(&workspace).unwrap();
    std::fs::write(&canary, "the person's secret").unwrap();
    let backend = WindowsAccountBackend::new(ACCOUNT, &data);
    backend.install_scripts().unwrap();

    for command in backend.setup_commands(false) {
        run(&command);
    }
    let (environment, variable) = backend.environment_command(false);
    let status = Command::new(&environment.program)
        .args(&environment.arguments)
        .env(variable, r#"{"ANTHROPIC_API_KEY":"sk-test-key-123"}"#)
        .status()
        .unwrap();
    assert!(status.success());
    assert!(backend.is_ready(), "the setup leaves its marker");

    let runner = SandboxedAgentRunner::new(
        ProcessAgentRunner::new(&["GITHUB_TOKEN"]),
        backend.clone(),
        &[],
    );
    let collected = Collecting::default();
    let outcome = runner
        .run(
            &stand_in_agent(&canary, &workspace),
            workspace.to_str().unwrap(),
            &collected,
        )
        .await;
    let standard = output_of(&collected, OutputStream::Standard);
    let errors = output_of(&collected, OutputStream::Error);
    let unconfined = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            &format!("Get-Content -LiteralPath '{}'", canary.display()),
        ])
        .output()
        .unwrap();
    let written = std::fs::read_to_string(workspace.join("written.txt"));
    let jobs_left = std::fs::read_dir(data.join("agent-jobs")).unwrap().count();
    cleanup(&data, &workspace, &canary);

    let outcome = outcome.expect("the agent started and ended");
    assert_eq!(
        outcome.exit_code,
        Some(7),
        "the exit code travels back\n{standard}\n{errors}"
    );
    assert!(
        standard.to_lowercase().contains(&format!("\\{ACCOUNT}")),
        "it runs as the account: {standard}"
    );
    assert!(
        standard.contains("KEY=sk-test-key-123"),
        "it received its API key: {standard}"
    );
    assert!(
        standard.contains("CANARY=blocked"),
        "it cannot read the person's file: {standard}"
    );
    assert!(
        standard.contains("WROTE"),
        "it can work in its workspace: {standard}"
    );
    assert!(
        errors.contains("to-standard-error"),
        "the error channel arrives apart: {errors}"
    );
    assert!(
        written.unwrap().contains("quoted \"text\""),
        "arguments with quotes survive"
    );
    assert!(
        unconfined.status.success(),
        "the person's own session still reads the canary"
    );
    assert_eq!(
        jobs_left, 0,
        "the job files are removed once the agent ends"
    );
}
