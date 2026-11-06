use super::{AgentWorkspace, WorkspaceConflict};
use crate::error::BrnchResult;

/// Tells, before anything is published, which agents' work would clash with each other.
pub trait ConflictAnalyzer {
    fn find_conflicts(
        &self,
        workspaces: &[AgentWorkspace],
    ) -> impl Future<Output = BrnchResult<Vec<WorkspaceConflict>>> + Send;
}
