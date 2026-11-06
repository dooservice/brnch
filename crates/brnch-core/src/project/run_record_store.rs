use super::{WorkspaceId, WorkspaceRunDetails};
use crate::BrnchResult;

/// Durable memory of the task behind each workspace.
pub trait RunRecordStore {
    fn record_run(&self, workspace: &WorkspaceId, details: &WorkspaceRunDetails)
    -> BrnchResult<()>;

    fn find_run(&self, workspace: &WorkspaceId) -> BrnchResult<Option<WorkspaceRunDetails>>;

    /// Workspaces with a recorded run, whatever its state.
    fn workspaces_with_runs(&self) -> BrnchResult<Vec<WorkspaceId>>;
}
