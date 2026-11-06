//! Calls a running gitd (`make integration` starts one): two agents edit the same line of the
//! same file, and brnch must see the clash before anything is published.

use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;

use brnch_core::BrnchSettings;
use brnch_core::workspace::{
    AgentWorkspace, ConflictAnalyzer, WorkspaceProvider, WorkspaceRequest,
};
use brnch_gitd::GitdWorkspaceProvider;

const DEFAULT_REPOSITORY: &str = "https://github.com/octocat/Hello-World";
const SHARED_FILE: &str = "README";
const UNRELATED_FILE: &str = "NOTES.md";

/// Plays an agent: it edits a file and commits with plain git.
struct CommittingAgent;

impl CommittingAgent {
    fn commit(workspace: &AgentWorkspace, file: &str, content: &str) {
        fs::write(Path::new(&workspace.directory).join(file), content)
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
                "agent change",
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

async fn prepare(provider: &GitdWorkspaceProvider, name: &str) -> AgentWorkspace {
    let root = env::var("GITD_TEST_ROOT").expect("GITD_TEST_ROOT names a root of gitd's");
    let repository_url =
        env::var("GITD_TEST_REPOSITORY").unwrap_or_else(|_| DEFAULT_REPOSITORY.to_owned());
    provider
        .prepare(&WorkspaceRequest {
            repository_url,
            directory: format!("{root}/brnch-conflict-{name}-{}", std::process::id()),
            branch_name: format!("agents/conflict-{name}"),
            base_branch: None,
        })
        .await
        .expect("gitd prepares the workspace")
}

#[tokio::test]
#[ignore = "needs a running gitd; run it with make integration"]
async fn reports_the_file_two_agents_both_rewrote_and_ignores_unrelated_work() {
    let provider = GitdWorkspaceProvider::connect(BrnchSettings::default())
        .await
        .expect("a gitd answers on GITD_SOCKET");
    let first = prepare(&provider, "first").await;
    let second = prepare(&provider, "second").await;
    let third = prepare(&provider, "third").await;
    CommittingAgent::commit(&first, SHARED_FILE, "first agent's version\n");
    CommittingAgent::commit(&second, SHARED_FILE, "second agent's version\n");
    CommittingAgent::commit(&third, UNRELATED_FILE, "notes\n");

    let conflicts = provider
        .find_conflicts(&[first.clone(), second.clone(), third.clone()])
        .await
        .expect("gitd analyzes the workspaces");

    assert_eq!(conflicts.len(), 1);
    assert_eq!(conflicts[0].clashing_paths, [SHARED_FILE]);
    let clashing = [
        &conflicts[0].first_directory,
        &conflicts[0].second_directory,
    ];
    assert!(clashing.contains(&&first.directory));
    assert!(clashing.contains(&&second.directory));
    for workspace in [first, second, third] {
        provider
            .remove(&workspace)
            .await
            .expect("gitd removes the workspace");
    }
}
