use brnch_agents::AgentEvent;
use brnch_core::project::{EventHistoryStore, ProjectStore, RunRecordStore, WorkspaceRunDetails};
use brnch_desktop::{ProjectService, WorkspaceStatus, close_interrupted_runs};
use brnch_store::SqliteProjectStore;
use std::sync::Arc;

fn finished(succeeded: bool) -> String {
    serde_json::to_string(&AgentEvent::RunFinished {
        succeeded,
        summary: String::new(),
        cost_in_dollars: Some(0.25),
        duration_in_milliseconds: Some(3_000),
        total_tokens: Some(1_200),
    })
    .unwrap()
}

fn details() -> WorkspaceRunDetails {
    WorkspaceRunDetails {
        run_identifier: "run".to_owned(),
        agent_kind: "claude_code".to_owned(),
        permission_mode: "edit_files".to_owned(),
        title: "Add search".to_owned(),
        prompt: "p".to_owned(),
        started_at_milliseconds: 5,
        base_commit: None,
    }
}

#[test]
fn a_workspace_is_idle_running_done_or_failed_depending_on_its_history() {
    let store = Arc::new(SqliteProjectStore::open_in_memory().unwrap());
    let project = store.add_project("p", "https://example.com/p").unwrap();
    let idle = store
        .add_workspace(&project.identifier, "/a", "agents/a")
        .unwrap();
    let running = store
        .add_workspace(&project.identifier, "/b", "agents/b")
        .unwrap();
    let done = store
        .add_workspace(&project.identifier, "/c", "agents/c")
        .unwrap();
    let failed = store
        .add_workspace(&project.identifier, "/d", "agents/d")
        .unwrap();
    for workspace in [&running, &done, &failed] {
        store.record_run(&workspace.identifier, &details()).unwrap();
    }
    store
        .append_event(&done.identifier, &finished(true))
        .unwrap();
    store
        .append_event(&failed.identifier, &finished(false))
        .unwrap();
    let service = ProjectService::new(Arc::clone(&store));

    let summaries = service
        .list_workspaces(project.identifier.as_str())
        .unwrap();

    let statuses: Vec<WorkspaceStatus> = summaries.iter().map(|summary| summary.status).collect();
    assert_eq!(
        statuses,
        [
            WorkspaceStatus::Idle,
            WorkspaceStatus::Running,
            WorkspaceStatus::Done,
            WorkspaceStatus::Failed
        ]
    );
    assert_eq!(summaries[0].title, "agents/a");
    assert_eq!(summaries[2].title, "Add search");
    assert_eq!(summaries[2].agent_label, "Claude Code");
    assert_eq!(summaries[2].cost_in_dollars, Some(0.25));
    assert_eq!(summaries[2].duration_in_milliseconds, Some(3_000));
    assert_eq!(idle.identifier.as_str(), summaries[0].identifier);
}

#[test]
fn a_run_left_working_by_an_earlier_session_is_closed_as_failed_once() {
    let store = Arc::new(SqliteProjectStore::open_in_memory().unwrap());
    let project = store.add_project("p", "https://example.com/p").unwrap();
    let stuck = store
        .add_workspace(&project.identifier, "/a", "agents/a")
        .unwrap();
    let ended = store
        .add_workspace(&project.identifier, "/b", "agents/b")
        .unwrap();
    store.record_run(&stuck.identifier, &details()).unwrap();
    store.record_run(&ended.identifier, &details()).unwrap();
    store
        .append_event(&ended.identifier, &finished(true))
        .unwrap();

    assert_eq!(close_interrupted_runs(&*store).unwrap(), 1);
    assert_eq!(close_interrupted_runs(&*store).unwrap(), 0);

    let service = ProjectService::new(store);
    let statuses: Vec<WorkspaceStatus> = service
        .list_workspaces(project.identifier.as_str())
        .unwrap()
        .iter()
        .map(|summary| summary.status)
        .collect();
    assert_eq!(statuses, [WorkspaceStatus::Failed, WorkspaceStatus::Done]);
}
