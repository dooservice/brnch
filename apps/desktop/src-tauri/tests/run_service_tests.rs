use std::future::{Future, pending, ready};
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use brnch_agents::AgentKind;
use brnch_core::agent::PermissionMode;
use brnch_core::agent::{
    AgentCommand, AgentOutcome, AgentOutputLine, AgentOutputListener, AgentRunner, OutputStream,
};
use brnch_core::project::{EventHistoryStore, ProjectStore, RunRecordStore};
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
    hangs: bool,
    commands: Arc<Mutex<Vec<AgentCommand>>>,
}

#[allow(refining_impl_trait)]
impl AgentRunner for ScriptedClaude {
    fn run(
        &self,
        command: &AgentCommand,
        _directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> Pin<Box<dyn Future<Output = BrnchResult<AgentOutcome>> + Send>> {
        self.commands.lock().unwrap().push(command.clone());
        if !self.starts {
            return Box::pin(ready(Err(BrnchError::AgentProcess(
                "not installed".to_owned(),
            ))));
        }
        if self.hangs {
            return Box::pin(pending());
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
        Box::pin(ready(Ok(AgentOutcome { exit_code: Some(0) })))
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

type TestService = RunService<InstantProvider, ScriptedClaude, SqliteProjectStore>;

fn service(starts: bool) -> (TestService, Arc<SqliteProjectStore>) {
    let (service, store, _) = service_with(starts, false);
    (service, store)
}

fn service_with(
    starts: bool,
    hangs: bool,
) -> (
    TestService,
    Arc<SqliteProjectStore>,
    Arc<Mutex<Vec<AgentCommand>>>,
) {
    let store = Arc::new(SqliteProjectStore::open_in_memory().unwrap());
    let commands = Arc::new(Mutex::new(Vec::new()));
    let service = RunService::new(
        BrnchSettings::default(),
        Arc::new(InstantProvider),
        ScriptedClaude {
            starts,
            hangs,
            commands: Arc::clone(&commands),
        },
        Arc::clone(&store),
        PathBuf::from("/work"),
    );
    (service, store, commands)
}

fn request(project_identifier: &str, copies: u32) -> StartRunRequest {
    StartRunRequest {
        project_identifier: project_identifier.to_owned(),
        run_label: "Add search".to_owned(),
        prompt: "add a search box".to_owned(),
        agent_kind: AgentKind::ClaudeCode,
        permission_mode: PermissionMode::EditFiles,
        base_branch: None,
        copies,
        maximum_minutes: None,
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
        wait_for_events(&store, workspace, 3).await;
        let events = store.list_events(workspace, 0).unwrap();
        assert!(events[0].event_json.contains(r#""kind":"user_message""#));
        assert!(events[1].event_json.contains(r#""kind":"session_started""#));
        assert!(events[2].event_json.contains(r#""kind":"run_finished""#));
    }
    assert_eq!(notifier.notices.lock().unwrap().len(), 6);
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

    wait_for_events(&store, &started[0], 2).await;
    let event = &store.list_events(&started[0], 0).unwrap()[1].event_json;
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

#[tokio::test]
async fn a_working_agent_can_be_stopped_and_the_history_says_so() {
    let (service, store, _) = service_with(true, true);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());
    let started = service
        .start(&request(project.identifier.as_str(), 1), &notifier)
        .unwrap();
    wait_for_events(&store, &started[0], 1).await;

    assert!(service.stop(started[0].as_str(), &notifier));

    let last = store.last_event(&started[0]).unwrap().unwrap().event_json;
    assert!(last.contains(r#""succeeded":false"#));
    assert!(last.contains("Detenido"));
    assert!(!service.stop(started[0].as_str(), &notifier));
}

#[tokio::test]
async fn a_follow_up_resumes_the_session_the_agent_started_and_is_refused_while_it_works() {
    let (service, store, commands) = service_with(true, false);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());
    let started = service
        .start(&request(project.identifier.as_str(), 1), &notifier)
        .unwrap();
    wait_for_events(&store, &started[0], 3).await;
    for _ in 0..200 {
        if service
            .follow_up(started[0].as_str(), "now add tests", &notifier)
            .is_ok()
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    wait_for_events(&store, &started[0], 6).await;
    let resumed = commands.lock().unwrap().last().unwrap().clone();
    assert!(
        resumed
            .arguments
            .windows(2)
            .any(|pair| pair == ["--resume", "s"])
    );
    assert_eq!(resumed.arguments.last().unwrap(), "now add tests");
    let events = store.list_events(&started[0], 0).unwrap();
    assert!(events[3].event_json.contains("now add tests"));
}

#[tokio::test]
async fn a_follow_up_needs_a_session_to_continue() {
    let (service, store, _) = service_with(false, false);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());
    let started = service
        .start(&request(project.identifier.as_str(), 1), &notifier)
        .unwrap();
    wait_for_events(&store, &started[0], 2).await;

    let result = service.follow_up(started[0].as_str(), "again", &notifier);

    assert!(
        matches!(result, Err(BrnchError::AgentProcess(message)) if message.contains("no session"))
    );
}

#[tokio::test]
async fn a_project_with_its_own_folder_gets_its_workspaces_there_and_a_finished_run_keeps_its_base_commit()
 {
    let (service, store) = service(true);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    store
        .update_project_settings(&project.identifier, Some("develop"), Some("/disk/mine"))
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());

    let started = service
        .start(&request(project.identifier.as_str(), 1), &notifier)
        .unwrap();

    let workspace = store.find_workspace(&started[0]).unwrap().unwrap();
    assert_eq!(workspace.directory, "/disk/mine/add-search");
    wait_for_events(&store, &started[0], 3).await;
    for _ in 0..200 {
        if store
            .find_run(&started[0])
            .unwrap()
            .unwrap()
            .base_commit
            .is_some()
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    assert_eq!(
        store
            .find_run(&started[0])
            .unwrap()
            .unwrap()
            .base_commit
            .as_deref(),
        Some("abc")
    );
}

#[tokio::test]
async fn an_agent_that_works_longer_than_the_limit_is_stopped_and_the_history_says_why() {
    let (service, store, _) = service_with(true, true);
    let project = store
        .add_project("web-store", "https://example.com/web")
        .unwrap();
    let notifier: Arc<dyn RunNotifier> = Arc::new(CollectingNotifier::default());
    let mut limited = request(project.identifier.as_str(), 1);
    limited.maximum_minutes = Some(0);

    let started = service.start(&limited, &notifier).unwrap();

    wait_for_events(&store, &started[0], 2).await;
    let last = store.last_event(&started[0]).unwrap().unwrap().event_json;
    assert!(last.contains("time limit"));
}
