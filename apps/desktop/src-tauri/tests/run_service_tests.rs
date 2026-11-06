use std::future::ready;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use brnch_agents::AgentKind;
use brnch_core::agent::{
    AgentCommand, AgentOutcome, AgentOutputLine, AgentOutputListener, AgentRunner, OutputStream,
};
use brnch_core::project::{EventHistoryStore, ProjectStore};
use brnch_core::workspace::{
    AgentWorkspace, PublishedBranch, WorkspaceDiff, WorkspaceProvider, WorkspaceRequest,
};
use brnch_core::{BrnchError, BrnchResult, BrnchSettings};
use brnch_desktop::{RunNotice, RunNotifier, RunService, StartRunRequest};
use brnch_store::SqliteProjectStore;

struct InstantProvider;

impl WorkspaceProvider for InstantProvider {
    fn prepare(
        &self,
        request: &WorkspaceRequest,
    ) -> impl Future<Output = BrnchResult<AgentWorkspace>> + Send {
        ready(Ok(AgentWorkspace {
            directory: request.directory.clone(),
            base_commit: "abc".to_owned(),
        }))
    }

    fn read_diff(
        &self,
        _workspace: &AgentWorkspace,
    ) -> impl Future<Output = BrnchResult<WorkspaceDiff>> + Send {
        ready(Ok(WorkspaceDiff {
            unified_diff: String::new(),
            was_truncated: false,
        }))
    }

    fn publish(
        &self,
        _workspace: &AgentWorkspace,
        branch_name: &str,
    ) -> impl Future<Output = BrnchResult<PublishedBranch>> + Send {
        ready(Ok(PublishedBranch {
            name: branch_name.to_owned(),
        }))
    }

    fn remove(&self, _workspace: &AgentWorkspace) -> impl Future<Output = BrnchResult<()>> + Send {
        ready(Ok(()))
    }
}

/// Prints what Claude Code prints, or cannot start.
struct ScriptedClaude {
    starts: bool,
}

impl AgentRunner for ScriptedClaude {
    fn run(
        &self,
        _command: &AgentCommand,
        _directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> impl Future<Output = BrnchResult<AgentOutcome>> + Send {
        if !self.starts {
            return ready(Err(BrnchError::AgentProcess("not installed".to_owned())));
        }
        for text in [
            r#"{"type":"system","subtype":"init","session_id":"s","model":"m"}"#,
            r#"{"type":"result","is_error":false,"result":"done"}"#,
        ] {
            listener.received(AgentOutputLine {
                stream: OutputStream::Standard,
                text: text.to_owned(),
            });
        }
        ready(Ok(AgentOutcome { exit_code: Some(0) }))
    }
}

#[derive(Default)]
struct CollectingNotifier {
    notices: Mutex<Vec<RunNotice>>,
}

impl RunNotifier for CollectingNotifier {
    fn notify(&self, notice: RunNotice) {
        self.notices.lock().unwrap().push(notice);
    }
}

fn service(
    starts: bool,
) -> (
    RunService<InstantProvider, ScriptedClaude, SqliteProjectStore>,
    Arc<SqliteProjectStore>,
) {
    let store = Arc::new(SqliteProjectStore::open_in_memory().unwrap());
    let service = RunService::new(
        BrnchSettings::default(),
        InstantProvider,
        ScriptedClaude { starts },
        Arc::clone(&store),
        PathBuf::from("/work"),
    );
    (service, store)
}

fn request(project_identifier: &str, copies: u32) -> StartRunRequest {
    StartRunRequest {
        project_identifier: project_identifier.to_owned(),
        run_label: "Add search".to_owned(),
        prompt: "add a search box".to_owned(),
        agent_kind: AgentKind::ClaudeCode,
        copies,
    }
}

async fn wait_for_events(
    store: &SqliteProjectStore,
    workspace: &brnch_core::project::WorkspaceId,
    count: usize,
) {
    for _ in 0..200 {
        if store.list_events(workspace, 0).unwrap().len() >= count {
            return;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("the run never produced {count} events");
}

#[tokio::test]
async fn a_run_records_its_workspaces_and_keeps_and_announces_every_event() {
    let (service, store) = service(true);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier = Arc::new(CollectingNotifier::default());
    let as_notifier: Arc<dyn RunNotifier> = notifier.clone();

    let started = service
        .start(&request(project.identifier.as_str(), 2), &as_notifier)
        .unwrap();

    assert_eq!(started.len(), 2);
    let branches: Vec<String> = store
        .list_workspaces(&project.identifier)
        .unwrap()
        .into_iter()
        .map(|workspace| workspace.branch_name)
        .collect();
    assert_eq!(branches, ["agents/add-search", "agents/add-search-2"]);
    for workspace in &started {
        wait_for_events(&store, workspace, 2).await;
        let events = store.list_events(workspace, 0).unwrap();
        assert!(events[0].event_json.contains(r#""kind":"session_started""#));
        assert!(events[1].event_json.contains(r#""kind":"run_finished""#));
    }
    assert_eq!(notifier.notices.lock().unwrap().len(), 4);
}

#[tokio::test]
async fn an_agent_that_cannot_start_leaves_a_failed_run_in_the_history() {
    let (service, store) = service(false);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());

    let started = service
        .start(&request(project.identifier.as_str(), 1), &notifier)
        .unwrap();

    wait_for_events(&store, &started[0], 1).await;
    let event = &store.list_events(&started[0], 0).unwrap()[0].event_json;
    assert!(event.contains(r#""succeeded":false"#));
    assert!(event.contains("not installed"));
}

#[tokio::test]
async fn an_unknown_project_or_a_blank_label_starts_nothing() {
    let (service, store) = service(true);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());
    let mut blank = request(project.identifier.as_str(), 1);
    blank.run_label = "  ".to_owned();

    assert!(matches!(
        service.start(&request("missing", 1), &notifier),
        Err(BrnchError::UnknownProject(_))
    ));
    assert!(matches!(
        service.start(&blank, &notifier),
        Err(BrnchError::EmptyRunLabel)
    ));
    assert_eq!(store.list_workspaces(&project.identifier).unwrap().len(), 0);
}
