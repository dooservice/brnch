use std::future::ready;
use std::sync::Mutex;

use brnch_core::agent::{
    AgentCommand, AgentDefinition, AgentOutcome, AgentOutputLine, AgentOutputListener,
    AgentRunCoordinator, AgentRunRequest, AgentRunner, OutputStream,
};
use brnch_core::workspace::{
    AgentWorkspace, PublishedBranch, WorkspaceDiff, WorkspaceProvider, WorkspaceRequest,
};
use brnch_core::{BrnchError, BrnchResult, BrnchSettings};

/// A provider that makes nothing and remembers what it was asked.
#[derive(Default)]
struct RecordingWorkspaceProvider {
    calls: Mutex<Vec<String>>,
}

impl RecordingWorkspaceProvider {
    fn record(&self, call: &str) {
        self.calls.lock().unwrap().push(call.to_owned());
    }

    fn calls(&self) -> Vec<String> {
        self.calls.lock().unwrap().clone()
    }
}

impl WorkspaceProvider for RecordingWorkspaceProvider {
    fn prepare(
        &self,
        request: &WorkspaceRequest,
    ) -> impl Future<Output = BrnchResult<AgentWorkspace>> + Send {
        self.record(&format!("prepare {}", request.branch_name));
        ready(Ok(AgentWorkspace {
            directory: request.directory.clone(),
            base_commit: "abc".to_owned(),
        }))
    }

    fn read_diff(
        &self,
        workspace: &AgentWorkspace,
    ) -> impl Future<Output = BrnchResult<WorkspaceDiff>> + Send {
        self.record(&format!("read_diff {}", workspace.directory));
        ready(Ok(WorkspaceDiff {
            unified_diff: "+changed".to_owned(),
            was_truncated: false,
        }))
    }

    fn publish(
        &self,
        workspace: &AgentWorkspace,
        branch_name: &str,
    ) -> impl Future<Output = BrnchResult<PublishedBranch>> + Send {
        self.record(&format!("publish {} {}", workspace.directory, branch_name));
        ready(Ok(PublishedBranch {
            name: branch_name.to_owned(),
        }))
    }

    fn remove(&self, workspace: &AgentWorkspace) -> impl Future<Output = BrnchResult<()>> + Send {
        self.record(&format!("remove {}", workspace.directory));
        ready(Ok(()))
    }
}

/// A runner whose agent prints one line and ends, or cannot start.
struct ScriptedAgentRunner {
    starts: bool,
}

impl AgentRunner for ScriptedAgentRunner {
    fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> impl Future<Output = BrnchResult<AgentOutcome>> + Send {
        if !self.starts {
            return ready(Err(BrnchError::AgentProcess("no such program".to_owned())));
        }
        listener.received(AgentOutputLine {
            stream: OutputStream::Standard,
            text: format!("{} in {directory}", command.arguments.join(" ")),
        });
        ready(Ok(AgentOutcome { exit_code: Some(0) }))
    }
}

#[derive(Default)]
struct CollectingListener {
    lines: Mutex<Vec<AgentOutputLine>>,
}

impl AgentOutputListener for CollectingListener {
    fn received(&self, line: AgentOutputLine) {
        self.lines.lock().unwrap().push(line);
    }
}

fn request() -> AgentRunRequest {
    AgentRunRequest {
        repository_url: "https://example.com/acme/web".to_owned(),
        workspace_directory: "/work/agent-1".to_owned(),
        run_label: "Fix login".to_owned(),
        prompt: "make the login work".to_owned(),
    }
}

#[tokio::test]
async fn prepares_runs_the_agent_and_reads_the_diff_without_publishing() {
    let settings = BrnchSettings::default();
    let provider = RecordingWorkspaceProvider::default();
    let runner = ScriptedAgentRunner { starts: true };
    let listener = CollectingListener::default();
    let agent = AgentDefinition::new("Scripted", "agent", &["--quiet"]);

    let report = AgentRunCoordinator::new(&settings, &provider, &runner)
        .run(&agent, &request(), &listener)
        .await
        .unwrap();

    assert_eq!(
        provider.calls(),
        ["prepare agents/fix-login", "read_diff /work/agent-1"]
    );
    assert_eq!(report.branch_name, "agents/fix-login");
    assert_eq!(report.workspace.directory, "/work/agent-1");
    assert!(report.outcome.succeeded());
    assert_eq!(report.diff.unified_diff, "+changed");
    assert_eq!(
        *listener.lines.lock().unwrap(),
        [AgentOutputLine {
            stream: OutputStream::Standard,
            text: "--quiet make the login work in /work/agent-1".to_owned(),
        }]
    );
}

#[tokio::test]
async fn removes_the_workspace_when_the_agent_cannot_start() {
    let settings = BrnchSettings::default();
    let provider = RecordingWorkspaceProvider::default();
    let runner = ScriptedAgentRunner { starts: false };
    let agent = AgentDefinition::new("Scripted", "agent", &[]);

    let failure = AgentRunCoordinator::new(&settings, &provider, &runner)
        .run(&agent, &request(), &CollectingListener::default())
        .await
        .unwrap_err();

    assert!(matches!(failure, BrnchError::AgentProcess(_)));
    assert_eq!(
        provider.calls(),
        ["prepare agents/fix-login", "remove /work/agent-1"]
    );
}

#[tokio::test]
async fn refuses_a_blank_label_before_making_any_workspace() {
    let settings = BrnchSettings::default();
    let provider = RecordingWorkspaceProvider::default();
    let runner = ScriptedAgentRunner { starts: true };
    let agent = AgentDefinition::new("Scripted", "agent", &[]);
    let mut blank = request();
    blank.run_label = "  ".to_owned();

    let failure = AgentRunCoordinator::new(&settings, &provider, &runner)
        .run(&agent, &blank, &CollectingListener::default())
        .await
        .unwrap_err();

    assert!(matches!(failure, BrnchError::EmptyRunLabel));
    assert_eq!(provider.calls(), Vec::<String>::new());
}

#[test]
fn builds_the_claude_code_command_with_the_prompt_last() {
    let command = AgentDefinition::claude_code().command_for("fix it");

    assert_eq!(command.program, "claude");
    assert_eq!(
        command.arguments,
        ["--print", "--permission-mode", "acceptEdits", "fix it"]
    );
}
