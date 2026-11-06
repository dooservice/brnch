use std::path::PathBuf;
use std::sync::Arc;

use brnch_core::{BrnchResult, BrnchSettings};
use brnch_gitd::GitdWorkspaceProvider;
use brnch_process::ProcessAgentRunner;
use brnch_sandbox::{SandboxSelector, SandboxedAgentRunner};
use brnch_store::SqliteProjectStore;
use tokio::sync::OnceCell;

use crate::{RunNotifier, RunService, StartRunRequest};

type RealRunService = RunService<
    GitdWorkspaceProvider,
    SandboxedAgentRunner<ProcessAgentRunner, SandboxSelector>,
    SqliteProjectStore,
>;

/// Connects to gitd the first time a run is asked for, so the window opens even when gitd
/// is not running yet and the person is told what is missing instead.
pub struct RunGateway {
    store: Arc<SqliteProjectStore>,
    workspaces_root: PathBuf,
    read_only_directories: Vec<String>,
    service: OnceCell<RealRunService>,
}

impl RunGateway {
    pub fn new(
        store: Arc<SqliteProjectStore>,
        workspaces_root: PathBuf,
        read_only_directories: Vec<String>,
    ) -> Self {
        Self {
            store,
            workspaces_root,
            read_only_directories,
            service: OnceCell::new(),
        }
    }

    pub async fn start(
        &self,
        request: &StartRunRequest,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<Vec<String>> {
        let service = self.service.get_or_try_init(|| self.connect()).await?;
        let started = service.start(request, notifier)?;
        Ok(started
            .into_iter()
            .map(|workspace| workspace.as_str().to_owned())
            .collect())
    }

    async fn connect(&self) -> BrnchResult<RealRunService> {
        let settings = BrnchSettings::default();
        let provider = GitdWorkspaceProvider::connect(settings.clone()).await?;
        let process = ProcessAgentRunner::new(settings.git_credential_variables);
        let directories: Vec<&str> = self
            .read_only_directories
            .iter()
            .map(String::as_str)
            .collect();
        let runner =
            SandboxedAgentRunner::new(process, SandboxSelector::for_current_system(), &directories);
        Ok(RunService::new(
            settings,
            provider,
            runner,
            Arc::clone(&self.store),
            self.workspaces_root.clone(),
        ))
    }
}
