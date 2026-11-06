//! Calls a running gitd (`make integration` starts one). `GITD_SOCKET` names its socket and
//! `GITD_TEST_ROOT` one of its roots, where the workspace is made and removed.

use std::env;
use std::fs;
use std::path::Path;

use brnch_core::BrnchSettings;
use brnch_core::workspace::{BranchNamer, WorkspaceProvider, WorkspaceRequest};
use brnch_gitd::GitdWorkspaceProvider;

const DEFAULT_REPOSITORY: &str = "https://github.com/octocat/Hello-World";
const AGENT_NOTE_FILE: &str = "AGENT.md";
const AGENT_NOTE: &str = "Written by an agent.\n";
const COMMIT_HASH_LENGTH: usize = 40;

/// The gitd under test, and the request the tests make of it.
struct IntegrationSubject {
    provider: GitdWorkspaceProvider,
    request: WorkspaceRequest,
}

impl IntegrationSubject {
    async fn new() -> Self {
        let settings = BrnchSettings::default();
        let branch_name = BranchNamer::new(&settings)
            .name_for("integration run")
            .expect("the run label can name a branch");
        let root = env::var("GITD_TEST_ROOT").expect("GITD_TEST_ROOT names a root of gitd's");
        let repository_url =
            env::var("GITD_TEST_REPOSITORY").unwrap_or_else(|_| DEFAULT_REPOSITORY.to_owned());
        let provider = GitdWorkspaceProvider::connect(settings)
            .await
            .expect("a gitd answers on GITD_SOCKET");
        Self {
            provider,
            request: WorkspaceRequest {
                repository_url,
                directory: format!("{root}/brnch-{}", std::process::id()),
                branch_name,
            },
        }
    }
}

#[tokio::test]
#[ignore = "needs a running gitd; run it with make integration"]
async fn prepares_reads_the_diff_of_and_removes_a_workspace() {
    let subject = IntegrationSubject::new().await;

    let workspace = subject
        .provider
        .prepare(&subject.request)
        .await
        .expect("gitd prepares the workspace");
    assert_eq!(workspace.directory, subject.request.directory);
    assert_eq!(workspace.base_commit.len(), COMMIT_HASH_LENGTH);

    fs::write(
        Path::new(&workspace.directory).join(AGENT_NOTE_FILE),
        AGENT_NOTE,
    )
    .expect("the agent writes in its workspace");
    let diff = subject
        .provider
        .read_diff(&workspace)
        .await
        .expect("gitd reads the workspace's diff");
    assert!(
        diff.unified_diff.contains(AGENT_NOTE_FILE),
        "{}",
        diff.unified_diff
    );
    assert!(!diff.was_truncated);

    subject
        .provider
        .remove(&workspace)
        .await
        .expect("gitd removes the workspace");
    assert!(!Path::new(&workspace.directory).exists());
}
