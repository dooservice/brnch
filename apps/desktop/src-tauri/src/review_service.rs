use std::sync::Arc;

use brnch_core::project::{ProjectId, ProjectStore, WorkspaceId, WorkspaceRecord};
use brnch_core::workspace::{AgentWorkspace, ConflictAnalyzer, WorkspaceProvider};
use brnch_core::{BrnchError, BrnchResult};

use crate::{ConflictSummary, DiffSummary, PublishOutcome};

/// Reviewing what agents did: read a workspace's diff, find which workspaces clash and publish
/// the ones a person approves.
pub struct ReviewService<Provider, Store> {
    provider: Arc<Provider>,
    store: Arc<Store>,
}

impl<Provider, Store> ReviewService<Provider, Store>
where
    Provider: WorkspaceProvider + ConflictAnalyzer,
    Store: ProjectStore,
{
    pub fn new(provider: Arc<Provider>, store: Arc<Store>) -> Self {
        Self { provider, store }
    }

    pub async fn diff(&self, workspace_identifier: &str) -> BrnchResult<DiffSummary> {
        let record = self.record(workspace_identifier)?;
        let diff = self
            .provider
            .read_diff(&Self::workspace_of(&record))
            .await?;
        Ok(DiffSummary {
            unified_diff: diff.unified_diff,
            was_truncated: diff.was_truncated,
        })
    }

    /// Every pair of the project's workspaces that would not merge cleanly.
    pub async fn conflicts(&self, project_identifier: &str) -> BrnchResult<Vec<ConflictSummary>> {
        let records = self
            .store
            .list_workspaces(&ProjectId::new(project_identifier))?;
        if records.len() < 2 {
            return Ok(Vec::new());
        }
        let workspaces: Vec<AgentWorkspace> = records.iter().map(Self::workspace_of).collect();
        let conflicts = self.provider.find_conflicts(&workspaces).await?;
        let identifier_of = |directory: &str| {
            records
                .iter()
                .find(|record| record.directory == directory)
                .map(|record| record.identifier.as_str().to_owned())
                .unwrap_or_default()
        };
        Ok(conflicts
            .into_iter()
            .map(|conflict| ConflictSummary {
                first_workspace_identifier: identifier_of(&conflict.first_directory),
                second_workspace_identifier: identifier_of(&conflict.second_directory),
                clashing_paths: conflict.clashing_paths,
            })
            .collect())
    }

    /// Publishes in the order given. One failing does not stop the rest.
    pub async fn publish(&self, workspace_identifiers: &[String]) -> Vec<PublishOutcome> {
        let mut outcomes = Vec::new();
        for identifier in workspace_identifiers {
            let result = match self.record(identifier) {
                Ok(record) => self
                    .provider
                    .publish(&Self::workspace_of(&record), &record.branch_name)
                    .await
                    .map(|published| published.name),
                Err(failure) => Err(failure),
            };
            outcomes.push(match result {
                Ok(branch_name) => PublishOutcome {
                    workspace_identifier: identifier.clone(),
                    branch_name: Some(branch_name),
                    failure: None,
                },
                Err(failure) => PublishOutcome {
                    workspace_identifier: identifier.clone(),
                    branch_name: None,
                    failure: Some(failure.to_string()),
                },
            });
        }
        outcomes
    }

    fn record(&self, workspace_identifier: &str) -> BrnchResult<WorkspaceRecord> {
        self.store
            .find_workspace(&WorkspaceId::new(workspace_identifier))?
            .ok_or_else(|| BrnchError::UnknownWorkspace(workspace_identifier.to_owned()))
    }

    fn workspace_of(record: &WorkspaceRecord) -> AgentWorkspace {
        AgentWorkspace {
            directory: record.directory.clone(),
            base_commit: String::new(),
        }
    }
}
