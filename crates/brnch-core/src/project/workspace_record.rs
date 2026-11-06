use super::{ProjectId, WorkspaceId};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceRecord {
    pub identifier: WorkspaceId,
    pub project_identifier: ProjectId,
    pub directory: String,
    pub branch_name: String,
}
