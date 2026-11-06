use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use brnch_agents::{AgentCatalog, AgentEvent, AgentKind, EventSink, NormalizingListener};
use brnch_core::agent::{AgentRunCoordinator, AgentRunRequest, AgentRunner, PermissionMode};
use brnch_core::project::{
    EventHistoryStore, ProjectStore, RunRecordStore, WorkspaceId, WorkspaceRunDetails,
};
use brnch_core::workspace::{BranchNamer, WorkspaceProvider};
use brnch_core::{BrnchError, BrnchResult, BrnchSettings};
use tokio::task::AbortHandle;
use uuid::Uuid;

use crate::{RunNotifier, StartRunRequest, StoreAndNotifySink};

const STOPPED_BY_PERSON: &str = "Detenido por ti.";

struct Shared<Provider, Runner, Store> {
    settings: BrnchSettings,
    provider: Arc<Provider>,
    runner: Runner,
    store: Arc<Store>,
    workspaces_root: PathBuf,
    running: Mutex<HashMap<String, AbortHandle>>,
}

/// Starts runs from the window: it records each workspace and its task, lets the agents work in
/// the background, keeps what they do, and can stop them or continue their conversation.
pub struct RunService<Provider, Runner, Store> {
    shared: Arc<Shared<Provider, Runner, Store>>,
}

impl<Provider, Runner, Store> Clone for RunService<Provider, Runner, Store> {
    fn clone(&self) -> Self {
        Self {
            shared: Arc::clone(&self.shared),
        }
    }
}

impl<Provider, Runner, Store> RunService<Provider, Runner, Store>
where
    Provider: WorkspaceProvider + Send + Sync + 'static,
    Runner: AgentRunner + Send + Sync + 'static,
    Store: ProjectStore + EventHistoryStore + RunRecordStore + Send + Sync + 'static,
{
    pub fn new(
        settings: BrnchSettings,
        provider: Arc<Provider>,
        runner: Runner,
        store: Arc<Store>,
        workspaces_root: PathBuf,
    ) -> Self {
        Self {
            shared: Arc::new(Shared {
                settings,
                provider,
                runner,
                store,
                workspaces_root,
                running: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// Records one workspace per copy and starts its agent. Returns as soon as they are
    /// running; progress arrives through the notifier.
    pub fn start(
        &self,
        request: &StartRunRequest,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<Vec<WorkspaceId>> {
        let shared = &self.shared;
        let project = shared
            .store
            .list_projects()?
            .into_iter()
            .find(|candidate| candidate.identifier.as_str() == request.project_identifier)
            .ok_or_else(|| BrnchError::UnknownProject(request.project_identifier.clone()))?;
        let namer = BranchNamer::new(&shared.settings);
        let mut planned = Vec::new();
        for copy in 1..=request.copies.max(1) {
            let label = if copy == 1 {
                request.run_label.clone()
            } else {
                format!("{} {copy}", request.run_label)
            };
            planned.push(namer.name_for(&label)?);
        }
        let run_identifier = Uuid::new_v4().to_string();
        let mut started = Vec::new();
        for branch_name in planned {
            let directory = self.directory_for(
                project.workspaces_directory.as_deref(),
                &project.name,
                &branch_name,
            );
            let record =
                shared
                    .store
                    .add_workspace(&project.identifier, &directory, &branch_name)?;
            shared.store.record_run(
                &record.identifier,
                &WorkspaceRunDetails {
                    run_identifier: run_identifier.clone(),
                    agent_kind: Self::kind_name(request.agent_kind),
                    permission_mode: Self::mode_name(request.permission_mode),
                    title: request.run_label.clone(),
                    prompt: request.prompt.clone(),
                    started_at_milliseconds: Self::now_in_milliseconds(),
                    base_commit: None,
                },
            )?;
            started.push(record.identifier.clone());
            let run = AgentRunRequest {
                repository_url: project.repository_url.clone(),
                workspace_directory: directory,
                run_label: branch_name,
                prompt: request.prompt.clone(),
                base_branch: request
                    .base_branch
                    .clone()
                    .or_else(|| project.base_branch.clone()),
            };
            self.spawn_run(request, run, record.identifier, Arc::clone(notifier));
        }
        Ok(started)
    }

    /// Stops a working agent. Its process is killed when its task is dropped.
    pub fn stop(&self, workspace_identifier: &str, notifier: &Arc<dyn RunNotifier>) -> bool {
        let handle = self
            .shared
            .running
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(workspace_identifier);
        let Some(handle) = handle else {
            return false;
        };
        handle.abort();
        self.sink_for(&WorkspaceId::new(workspace_identifier), notifier)
            .publish(AgentEvent::RunFinished {
                succeeded: false,
                summary: STOPPED_BY_PERSON.to_owned(),
                cost_in_dollars: None,
                duration_in_milliseconds: None,
                total_tokens: None,
            });
        true
    }

    /// Continues the agent's conversation in the same workspace with a new message.
    pub fn follow_up(
        &self,
        workspace_identifier: &str,
        prompt: &str,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<()> {
        let shared = &self.shared;
        let workspace = WorkspaceId::new(workspace_identifier);
        let record = shared
            .store
            .find_workspace(&workspace)?
            .ok_or_else(|| BrnchError::UnknownWorkspace(workspace_identifier.to_owned()))?;
        let details = shared
            .store
            .find_run(&workspace)?
            .ok_or_else(|| BrnchError::UnknownWorkspace(workspace_identifier.to_owned()))?;
        if shared
            .running
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .contains_key(workspace_identifier)
        {
            return Err(BrnchError::AgentProcess(
                "the agent is still working: wait for it or stop it first".to_owned(),
            ));
        }
        let session = self.last_session_identifier(&workspace)?.ok_or_else(|| {
            BrnchError::AgentProcess("this agent has no session to continue yet".to_owned())
        })?;
        let kind = Self::kind_from_name(&details.agent_kind)?;
        let mode = Self::mode_from_name(&details.permission_mode);
        let command = AgentCatalog
            .definition(kind, mode)
            .command_for_resume(prompt, &session);
        let prompt = prompt.to_owned();
        let notifier = Arc::clone(notifier);
        let shared = Arc::clone(&self.shared);
        let key = workspace_identifier.to_owned();
        let task_key = key.clone();
        let handle = tokio::spawn(async move {
            let sink = StoreAndNotifySink {
                store: Arc::clone(&shared.store),
                workspace,
                notifier,
            };
            sink.publish(AgentEvent::UserMessage { text: prompt });
            let listener = NormalizingListener::new(AgentCatalog.normalizer(kind), &sink);
            let result = shared
                .runner
                .run(&command, &record.directory, &listener)
                .await;
            Self::forget(&shared, &task_key);
            if let Err(failure) = result {
                sink.publish(Self::failed_finish(&failure));
            }
        });
        self.shared
            .running
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(key, handle.abort_handle());
        Ok(())
    }

    fn last_session_identifier(&self, workspace: &WorkspaceId) -> BrnchResult<Option<String>> {
        let events = self.shared.store.list_events(workspace, 0)?;
        Ok(events.iter().rev().find_map(|stored| {
            match serde_json::from_str::<AgentEvent>(&stored.event_json) {
                Ok(AgentEvent::SessionStarted {
                    session_identifier, ..
                }) if !session_identifier.is_empty() => Some(session_identifier),
                _ => None,
            }
        }))
    }

    /// A project that names its own folder gets its workspaces directly inside it; the others go
    /// under the application's folder, in one subfolder per project.
    fn directory_for(
        &self,
        project_folder: Option<&str>,
        project_name: &str,
        branch_name: &str,
    ) -> String {
        let folder = branch_name.rsplit('/').next().unwrap_or(branch_name);
        let base = project_folder.map_or_else(
            || self.shared.workspaces_root.join(project_name),
            PathBuf::from,
        );
        base.join(folder).to_string_lossy().into_owned()
    }

    fn sink_for(
        &self,
        workspace: &WorkspaceId,
        notifier: &Arc<dyn RunNotifier>,
    ) -> StoreAndNotifySink<Store> {
        StoreAndNotifySink {
            store: Arc::clone(&self.shared.store),
            workspace: workspace.clone(),
            notifier: Arc::clone(notifier),
        }
    }

    fn spawn_run(
        &self,
        request: &StartRunRequest,
        run: AgentRunRequest,
        workspace: WorkspaceId,
        notifier: Arc<dyn RunNotifier>,
    ) {
        let shared = Arc::clone(&self.shared);
        let kind = request.agent_kind;
        let mode = request.permission_mode;
        let limit = request
            .maximum_minutes
            .map(|minutes| (minutes, Duration::from_secs(u64::from(minutes) * 60)));
        let key = workspace.as_str().to_owned();
        let task_key = key.clone();
        let handle = tokio::spawn(async move {
            let sink = StoreAndNotifySink {
                store: Arc::clone(&shared.store),
                workspace,
                notifier,
            };
            sink.publish(AgentEvent::UserMessage {
                text: run.prompt.clone(),
            });
            let catalog = AgentCatalog;
            let listener = NormalizingListener::new(catalog.normalizer(kind), &sink);
            let coordinator =
                AgentRunCoordinator::new(&shared.settings, &*shared.provider, &shared.runner);
            let definition = catalog.definition(kind, mode);
            let working = coordinator.run(&definition, &run, &listener);
            let result = match limit {
                Some((minutes, duration)) => tokio::time::timeout(duration, working)
                    .await
                    .unwrap_or_else(|_| {
                        Err(BrnchError::AgentProcess(format!(
                            "the time limit of {minutes} minutes was reached"
                        )))
                    }),
                None => working.await,
            };
            Self::forget(&shared, &task_key);
            match result {
                Ok(report) => {
                    let _ = shared
                        .store
                        .set_base_commit(&sink.workspace, &report.workspace.base_commit);
                }
                Err(failure) => sink.publish(Self::failed_finish(&failure)),
            }
        });
        self.shared
            .running
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(key, handle.abort_handle());
    }

    fn forget(shared: &Shared<Provider, Runner, Store>, key: &str) {
        shared
            .running
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(key);
    }

    fn failed_finish(failure: &BrnchError) -> AgentEvent {
        AgentEvent::RunFinished {
            succeeded: false,
            summary: failure.to_string(),
            cost_in_dollars: None,
            duration_in_milliseconds: None,
            total_tokens: None,
        }
    }

    fn kind_name(kind: AgentKind) -> String {
        match kind {
            AgentKind::ClaudeCode => "claude_code".to_owned(),
        }
    }

    fn kind_from_name(name: &str) -> BrnchResult<AgentKind> {
        serde_json::from_value(serde_json::Value::String(name.to_owned()))
            .map_err(|_| BrnchError::AgentProcess(format!("unknown agent {name:?}")))
    }

    fn mode_name(mode: PermissionMode) -> String {
        match mode {
            PermissionMode::EditFiles => "edit_files".to_owned(),
            PermissionMode::PlanOnly => "plan_only".to_owned(),
        }
    }

    fn mode_from_name(name: &str) -> PermissionMode {
        match name {
            "plan_only" => PermissionMode::PlanOnly,
            _ => PermissionMode::EditFiles,
        }
    }

    fn now_in_milliseconds() -> i64 {
        let elapsed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
    }
}
