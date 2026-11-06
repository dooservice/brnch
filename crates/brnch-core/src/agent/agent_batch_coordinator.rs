use futures_util::future::join_all;

use super::{AgentBatchItem, AgentBatchReport, AgentRunCoordinator, AgentRunner};
use crate::error::BrnchResult;
use crate::settings::BrnchSettings;
use crate::workspace::{AgentWorkspace, ConflictAnalyzer, WorkspaceProvider};

/// Runs several agents at the same time, each in its own workspace, then checks the finished
/// ones against each other. One agent failing does not stop the others.
pub struct AgentBatchCoordinator<'dependencies, Provider, Runner, Analyzer> {
    run_coordinator: AgentRunCoordinator<'dependencies, Provider, Runner>,
    analyzer: &'dependencies Analyzer,
}

impl<'dependencies, Provider, Runner, Analyzer>
    AgentBatchCoordinator<'dependencies, Provider, Runner, Analyzer>
where
    Provider: WorkspaceProvider,
    Runner: AgentRunner,
    Analyzer: ConflictAnalyzer,
{
    pub fn new(
        settings: &'dependencies BrnchSettings,
        provider: &'dependencies Provider,
        runner: &'dependencies Runner,
        analyzer: &'dependencies Analyzer,
    ) -> Self {
        Self {
            run_coordinator: AgentRunCoordinator::new(settings, provider, runner),
            analyzer,
        }
    }

    pub async fn run(&self, items: &[AgentBatchItem<'_>]) -> BrnchResult<AgentBatchReport> {
        let runs = join_all(items.iter().map(|item| {
            self.run_coordinator
                .run(&item.agent, &item.request, item.listener)
        }))
        .await;
        let finished: Vec<AgentWorkspace> = runs
            .iter()
            .filter_map(|run| run.as_ref().ok())
            .map(|report| report.workspace.clone())
            .collect();
        let conflicts = if finished.len() > 1 {
            self.analyzer.find_conflicts(&finished).await?
        } else {
            Vec::new()
        };
        Ok(AgentBatchReport { runs, conflicts })
    }
}
