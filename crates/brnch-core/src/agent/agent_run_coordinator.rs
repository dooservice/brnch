use super::{AgentDefinition, AgentOutputListener, AgentRunReport, AgentRunRequest, AgentRunner};
use crate::error::BrnchResult;
use crate::settings::BrnchSettings;
use crate::workspace::{AgentWorkspace, BranchNamer, WorkspaceProvider, WorkspaceRequest};

/// Carries one run from start to review: it makes the workspace, lets the agent work in it
/// and reads what changed.
pub struct AgentRunCoordinator<'dependencies, Provider, Runner> {
    settings: &'dependencies BrnchSettings,
    provider: &'dependencies Provider,
    runner: &'dependencies Runner,
}

impl<'dependencies, Provider, Runner> AgentRunCoordinator<'dependencies, Provider, Runner>
where
    Provider: WorkspaceProvider,
    Runner: AgentRunner,
{
    pub fn new(
        settings: &'dependencies BrnchSettings,
        provider: &'dependencies Provider,
        runner: &'dependencies Runner,
    ) -> Self {
        Self {
            settings,
            provider,
            runner,
        }
    }

    pub async fn run(
        &self,
        agent: &AgentDefinition,
        request: &AgentRunRequest,
        listener: &dyn AgentOutputListener,
    ) -> BrnchResult<AgentRunReport> {
        let branch_name = BranchNamer::new(self.settings).name_for(&request.run_label)?;
        let workspace = self
            .provider
            .prepare(&WorkspaceRequest {
                repository_url: request.repository_url.clone(),
                directory: request.workspace_directory.clone(),
                branch_name: branch_name.clone(),
            })
            .await?;
        let command = agent.command_for(&request.prompt);
        let outcome = match self
            .runner
            .run(&command, &workspace.directory, listener)
            .await
        {
            Ok(outcome) => outcome,
            Err(failure) => {
                self.discard(&workspace).await;
                return Err(failure);
            }
        };
        let diff = self.provider.read_diff(&workspace).await?;
        Ok(AgentRunReport {
            workspace,
            branch_name,
            outcome,
            diff,
        })
    }

    /// A workspace whose agent could not even start is of no use, so it is not left behind.
    async fn discard(&self, workspace: &AgentWorkspace) {
        let _ = self.provider.remove(workspace).await;
    }
}
