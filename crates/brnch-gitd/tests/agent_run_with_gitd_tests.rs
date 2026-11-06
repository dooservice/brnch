//! A whole run against a real gitd (`make integration`): the agent is a shell that writes a
//! file, and the diff gitd reads must show it.

use std::env;
use std::sync::Mutex;

use brnch_core::BrnchSettings;
use brnch_core::agent::{
    AgentDefinition, AgentOutputLine, AgentOutputListener, AgentRunCoordinator, AgentRunRequest,
};
use brnch_core::workspace::WorkspaceProvider;
use brnch_gitd::GitdWorkspaceProvider;
use brnch_process::ProcessAgentRunner;

const DEFAULT_REPOSITORY: &str = "https://github.com/octocat/Hello-World";
const AGENT_SCRIPT: &str = "printf 'Written by an agent.\\n' > AGENT.md; echo finished";

#[derive(Default)]
struct CollectingListener {
    lines: Mutex<Vec<AgentOutputLine>>,
}

impl AgentOutputListener for CollectingListener {
    fn received(&self, line: AgentOutputLine) {
        self.lines.lock().unwrap().push(line);
    }
}

#[tokio::test]
#[ignore = "needs a running gitd; run it with make integration"]
async fn an_agent_works_in_a_gitd_workspace_and_its_change_is_read() {
    let settings = BrnchSettings::default();
    let provider = GitdWorkspaceProvider::connect(settings.clone())
        .await
        .expect("a gitd answers on GITD_SOCKET");
    let runner = ProcessAgentRunner;
    let listener = CollectingListener::default();
    let root = env::var("GITD_TEST_ROOT").expect("GITD_TEST_ROOT names a root of gitd's");
    let request = AgentRunRequest {
        repository_url: env::var("GITD_TEST_REPOSITORY")
            .unwrap_or_else(|_| DEFAULT_REPOSITORY.to_owned()),
        workspace_directory: format!("{root}/brnch-run-{}", std::process::id()),
        run_label: "write a note".to_owned(),
        prompt: AGENT_SCRIPT.to_owned(),
    };
    let shell_agent = AgentDefinition::new("Shell", "sh", &["-c"]);

    let report = AgentRunCoordinator::new(&settings, &provider, &runner)
        .run(&shell_agent, &request, &listener)
        .await
        .expect("the run completes");

    assert!(report.outcome.succeeded());
    assert_eq!(report.branch_name, "agents/write-a-note");
    assert!(report.diff.unified_diff.contains("AGENT.md"));
    assert_eq!(listener.lines.lock().unwrap()[0].text, "finished");
    provider
        .remove(&report.workspace)
        .await
        .expect("gitd removes the workspace");
}
