//! Publishes a commit to a real remote through gitd. The "Sandbox probes" workflow runs it with a
//! gitd that holds the credential, and checks on the remote that the branch exists. Without
//! `GITD_TEST_PUBLISH_BRANCH` the test does nothing, so `make integration` stays green.

use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;

use brnch_core::BrnchSettings;
use brnch_core::workspace::{AgentWorkspace, WorkspaceProvider, WorkspaceRequest};
use brnch_gitd::GitdWorkspaceProvider;

const BRANCH_VARIABLE: &str = "GITD_TEST_PUBLISH_BRANCH";
const AGENT_NOTE_FILE: &str = "AGENT.md";
const AGENT_NOTE: &str = "Published through gitd by a process that held no token.\n";

/// Plays the agent: it edits and commits in its workspace with plain git and nothing else.
struct CommittingAgent;

impl CommittingAgent {
    fn commit_a_note(workspace: &AgentWorkspace) {
        fs::write(
            Path::new(&workspace.directory).join(AGENT_NOTE_FILE),
            AGENT_NOTE,
        )
        .expect("the agent writes in its workspace");
        Self::git(workspace, &["add", "-A"]);
        Self::git(
            workspace,
            &[
                "-c",
                "user.name=agent",
                "-c",
                "user.email=agent@example.com",
                "commit",
                "-q",
                "-m",
                "A note from an agent",
            ],
        );
    }

    fn git(workspace: &AgentWorkspace, arguments: &[&str]) {
        let status = Command::new("git")
            .args(arguments)
            .current_dir(&workspace.directory)
            .status()
            .expect("git runs");
        assert!(status.success(), "git {arguments:?} failed");
    }
}

#[tokio::test]
#[ignore = "needs a gitd that holds a credential for the repository; run by the Sandbox probes workflow"]
async fn publishes_a_commit_while_the_agent_holds_no_token() {
    let Ok(branch_name) = env::var(BRANCH_VARIABLE) else {
        println!("skipped: {BRANCH_VARIABLE} is not set");
        return;
    };
    let settings = BrnchSettings::default();
    for variable in settings.git_credential_variables {
        assert!(
            env::var(variable).is_err(),
            "{variable} is set in the agent's environment"
        );
    }
    let provider = GitdWorkspaceProvider::connect(settings)
        .await
        .expect("a gitd answers on GITD_SOCKET");
    let root = env::var("GITD_TEST_ROOT").expect("GITD_TEST_ROOT names a root of gitd's");
    let repository_url =
        env::var("GITD_TEST_REPOSITORY").expect("GITD_TEST_REPOSITORY names the remote");

    let workspace = provider
        .prepare(&WorkspaceRequest {
            repository_url,
            directory: format!("{root}/brnch-publish-{}", std::process::id()),
            branch_name: branch_name.clone(),
        })
        .await
        .expect("gitd prepares the workspace");
    CommittingAgent::commit_a_note(&workspace);

    let published = provider
        .publish(&workspace, &branch_name)
        .await
        .expect("gitd publishes the branch with the token it keeps");

    assert_eq!(published.name, branch_name);
    provider
        .remove(&workspace)
        .await
        .expect("gitd removes the workspace");
}
