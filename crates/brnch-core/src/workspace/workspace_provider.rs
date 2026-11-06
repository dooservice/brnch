use super::{AgentWorkspace, PublishedBranch, WorkspaceDiff, WorkspaceRequest};
use crate::error::BrnchResult;

/// Where agents get their workspaces from. gitd is the provider brnch ships with.
pub trait WorkspaceProvider {
    fn prepare(
        &self,
        request: &WorkspaceRequest,
    ) -> impl Future<Output = BrnchResult<AgentWorkspace>> + Send;

    fn read_diff(
        &self,
        workspace: &AgentWorkspace,
    ) -> impl Future<Output = BrnchResult<WorkspaceDiff>> + Send;

    fn publish(
        &self,
        workspace: &AgentWorkspace,
        branch_name: &str,
    ) -> impl Future<Output = BrnchResult<PublishedBranch>> + Send;

    fn remove(&self, workspace: &AgentWorkspace) -> impl Future<Output = BrnchResult<()>> + Send;
}
