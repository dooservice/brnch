use std::path::PathBuf;
use std::sync::Arc;

use brnch_agents::{AgentCatalog, AgentEvent, EventSink, NormalizingListener};
use brnch_core::agent::{AgentRunCoordinator, AgentRunRequest, AgentRunner};
use brnch_core::project::{EventHistoryStore, ProjectStore, WorkspaceId};
use brnch_core::workspace::{BranchNamer, WorkspaceProvider};
use brnch_core::{BrnchError, BrnchResult, BrnchSettings};

use crate::{RunNotifier, StartRunRequest, StoreAndNotifySink};

struct Shared<Provider, Runner, Store> {
    settings: BrnchSettings,
    provider: Provider,
    runner: Runner,
    store: Arc<Store>,
    workspaces_root: PathBuf,
}

/// Starts runs from the window: it records each workspace, lets the agents work in the
/// background and keeps what they do.
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
    Store: ProjectStore + EventHistoryStore + Send + Sync + 'static,
{
    pub fn new(
        settings: BrnchSettings,
        provider: Provider,
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
        let mut started = Vec::new();
        for branch_name in planned {
            let directory = self.directory_for(&project.name, &branch_name);
            let record =
                shared
                    .store
                    .add_workspace(&project.identifier, &directory, &branch_name)?;
            started.push(record.identifier.clone());
            let run = AgentRunRequest {
                repository_url: project.repository_url.clone(),
                workspace_directory: directory,
                run_label: branch_name.clone(),
                prompt: request.prompt.clone(),
            };
            self.spawn_run(request, run, record.identifier, Arc::clone(notifier));
        }
        Ok(started)
    }

    fn directory_for(&self, project_name: &str, branch_name: &str) -> String {
        let folder = branch_name.rsplit('/').next().unwrap_or(branch_name);
        self.shared
            .workspaces_root
            .join(project_name)
            .join(folder)
            .to_string_lossy()
            .into_owned()
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
        tokio::spawn(async move {
            let sink = StoreAndNotifySink {
                store: Arc::clone(&shared.store),
                workspace,
                notifier,
            };
            let catalog = AgentCatalog;
            let listener = NormalizingListener::new(catalog.normalizer(kind), &sink);
            let coordinator =
                AgentRunCoordinator::new(&shared.settings, &shared.provider, &shared.runner);
            let result = coordinator
                .run(&catalog.definition(kind), &run, &listener)
                .await;
            if let Err(failure) = result {
                sink.publish(AgentEvent::RunFinished {
                    succeeded: false,
                    summary: failure.to_string(),
                    cost_in_dollars: None,
                    duration_in_milliseconds: None,
                });
            }
        });
    }
}
