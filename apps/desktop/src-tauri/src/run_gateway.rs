use std::path::PathBuf;
use std::sync::Arc;

use brnch_core::{BrnchResult, BrnchSettings};
use brnch_gitd::GitdWorkspaceProvider;
use brnch_process::ProcessAgentRunner;
use brnch_sandbox::{SandboxSelector, SandboxStatus, SandboxedAgentRunner};
use brnch_store::SqliteProjectStore;
use tokio::sync::OnceCell;

use crate::{
    ConflictSummary, DiffSummary, PublishOutcome, ReviewService, RunNotifier, RunService,
    StartRunRequest,
};

type RealRunService = RunService<
    GitdWorkspaceProvider,
    SandboxedAgentRunner<ProcessAgentRunner, SandboxSelector>,
    SqliteProjectStore,
>;

struct Connected {
    runs: RealRunService,
    review: ReviewService<GitdWorkspaceProvider, SqliteProjectStore>,
}

/// Connects to gitd the first time a run is asked for, so the window opens even when gitd
/// is not running yet and the person is told what is missing instead.
pub struct RunGateway {
    store: Arc<SqliteProjectStore>,
    workspaces_root: PathBuf,
    read_only_directories: Vec<String>,
    connected: OnceCell<Connected>,
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
            connected: OnceCell::new(),
        }
    }

    pub async fn start(
        &self,
        request: &StartRunRequest,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<Vec<String>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        let started = connected.runs.start(request, notifier)?;
        Ok(started
            .into_iter()
            .map(|workspace| workspace.as_str().to_owned())
            .collect())
    }

    pub async fn stop(
        &self,
        workspace_identifier: &str,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<bool> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected.runs.stop(workspace_identifier, notifier))
    }

    pub async fn follow_up(
        &self,
        workspace_identifier: &str,
        prompt: &str,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<()> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected
            .runs
            .follow_up(workspace_identifier, prompt, notifier)
    }

    /// Does not need gitd, so the window can show it before anything is connected.
    pub fn sandbox_status(&self) -> SandboxStatus {
        SandboxSelector::for_current_system().status()
    }

    pub async fn diff(&self, workspace_identifier: &str) -> BrnchResult<DiffSummary> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected.review.diff(workspace_identifier).await
    }

    pub async fn conflicts(&self, project_identifier: &str) -> BrnchResult<Vec<ConflictSummary>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected.review.conflicts(project_identifier).await
    }

    pub async fn publish(
        &self,
        workspace_identifiers: &[String],
    ) -> BrnchResult<Vec<PublishOutcome>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected.review.publish(workspace_identifiers).await)
    }

    async fn connect(&self) -> BrnchResult<Connected> {
        let settings = BrnchSettings::default();
        let provider = Arc::new(GitdWorkspaceProvider::connect(settings.clone()).await?);
        let process = ProcessAgentRunner::new(settings.git_credential_variables);
        let directories: Vec<&str> = self
            .read_only_directories
            .iter()
            .map(String::as_str)
            .collect();
        let runner =
            SandboxedAgentRunner::new(process, SandboxSelector::for_current_system(), &directories);
        Ok(Connected {
            runs: RunService::new(
                settings,
                Arc::clone(&provider),
                runner,
                Arc::clone(&self.store),
                self.workspaces_root.clone(),
            ),
            review: ReviewService::new(provider, Arc::clone(&self.store)),
        })
    }
}
