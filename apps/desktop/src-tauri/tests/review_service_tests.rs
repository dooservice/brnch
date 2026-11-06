use std::future::ready;
use std::sync::Arc;

use brnch_core::project::ProjectStore;
use brnch_core::workspace::{
    AgentWorkspace, ConflictAnalyzer, PublishedBranch, WorkspaceConflict, WorkspaceDiff,
    WorkspaceProvider, WorkspaceRequest,
};
use brnch_core::{BrnchError, BrnchResult};
use brnch_desktop::ReviewService;
use brnch_store::SqliteProjectStore;

/// Publishing fails for the workspace in "/work/rejected"; conflicts are always between the
/// first two it is given.
struct FakeGitd;

impl WorkspaceProvider for FakeGitd {
    fn prepare(
        &self,
        request: &WorkspaceRequest,
    ) -> impl Future<Output = BrnchResult<AgentWorkspace>> + Send {
        ready(Ok(AgentWorkspace {
            directory: request.directory.clone(),
            base_commit: String::new(),
        }))
    }

    fn read_diff(
        &self,
        workspace: &AgentWorkspace,
    ) -> impl Future<Output = BrnchResult<WorkspaceDiff>> + Send {
        ready(Ok(WorkspaceDiff {
            unified_diff: format!("diff of {}", workspace.directory),
            was_truncated: true,
        }))
    }

    fn publish(
        &self,
        workspace: &AgentWorkspace,
        branch_name: &str,
    ) -> impl Future<Output = BrnchResult<PublishedBranch>> + Send {
        ready(if workspace.directory.contains("rejected") {
            Err(BrnchError::WorkspaceProvider(
                "policy refused the branch".to_owned(),
            ))
        } else {
            Ok(PublishedBranch {
                name: branch_name.to_owned(),
            })
        })
    }

    fn remove(&self, _workspace: &AgentWorkspace) -> impl Future<Output = BrnchResult<()>> + Send {
        ready(Ok(()))
    }
}

impl ConflictAnalyzer for FakeGitd {
    fn find_conflicts(
        &self,
        workspaces: &[AgentWorkspace],
    ) -> impl Future<Output = BrnchResult<Vec<WorkspaceConflict>>> + Send {
        ready(Ok(vec![WorkspaceConflict {
            first_directory: workspaces[0].directory.clone(),
            second_directory: workspaces[1].directory.clone(),
            clashing_paths: vec!["src/lib.rs".to_owned()],
        }]))
    }
}

fn service_with_workspaces(
    directories: &[&str],
) -> (
    ReviewService<FakeGitd, SqliteProjectStore>,
    brnch_core::project::ProjectRecord,
    Vec<String>,
) {
    let store = Arc::new(SqliteProjectStore::open_in_memory().unwrap());
    let project = store.add_project("web", "https://example.com/web").unwrap();
    let identifiers = directories
        .iter()
        .enumerate()
        .map(|(index, directory)| {
            store
                .add_workspace(
                    &project.identifier,
                    directory,
                    &format!("agents/task-{index}"),
                )
                .unwrap()
                .identifier
                .as_str()
                .to_owned()
        })
        .collect();
    (
        ReviewService::new(Arc::new(FakeGitd), store),
        project,
        identifiers,
    )
}

#[tokio::test]
async fn the_diff_of_a_workspace_comes_from_its_directory() {
    let (service, _, identifiers) = service_with_workspaces(&["/work/a"]);

    let diff = service.diff(&identifiers[0]).await.unwrap();

    assert_eq!(diff.unified_diff, "diff of /work/a");
    assert!(diff.was_truncated);
}

#[tokio::test]
async fn conflicts_are_reported_by_workspace_identifier_and_need_two_workspaces() {
    let (service, project, identifiers) = service_with_workspaces(&["/work/a", "/work/b"]);
    let (alone, alone_project, _) = service_with_workspaces(&["/work/only"]);

    let conflicts = service
        .conflicts(project.identifier.as_str())
        .await
        .unwrap();

    assert_eq!(conflicts.len(), 1);
    assert_eq!(conflicts[0].first_workspace_identifier, identifiers[0]);
    assert_eq!(conflicts[0].second_workspace_identifier, identifiers[1]);
    assert_eq!(conflicts[0].clashing_paths, ["src/lib.rs"]);
    assert_eq!(
        alone
            .conflicts(alone_project.identifier.as_str())
            .await
            .unwrap()
            .len(),
        0
    );
}

#[tokio::test]
async fn publishing_reports_each_workspace_and_one_refusal_does_not_stop_the_rest() {
    let (service, _, identifiers) =
        service_with_workspaces(&["/work/a", "/work/rejected", "/work/c"]);

    let outcomes = service.publish(&identifiers).await;

    assert_eq!(outcomes[0].branch_name.as_deref(), Some("agents/task-0"));
    assert_eq!(outcomes[1].branch_name, None);
    assert!(
        outcomes[1]
            .failure
            .as_deref()
            .unwrap()
            .contains("policy refused")
    );
    assert_eq!(outcomes[2].branch_name.as_deref(), Some("agents/task-2"));
}

#[tokio::test]
async fn an_unknown_workspace_is_a_failure_in_the_report_not_a_crash() {
    let (service, _, _) = service_with_workspaces(&["/work/a"]);

    let outcomes = service.publish(&["missing".to_owned()]).await;

    assert!(
        outcomes[0]
            .failure
            .as_deref()
            .unwrap()
            .contains("no workspace")
    );
}
