use super::{ProjectId, ProjectRecord, ProjectView, WorkspaceId, WorkspaceRecord};
use crate::BrnchResult;

/// Durable memory of projects, their workspaces and what was open in each.
pub trait ProjectStore {
    fn add_project(&self, name: &str, repository_url: &str) -> BrnchResult<ProjectRecord>;

    fn update_project_settings(
        &self,
        project: &ProjectId,
        base_branch: Option<&str>,
        workspaces_directory: Option<&str>,
    ) -> BrnchResult<()>;

    /// Most recently opened first.
    fn list_projects(&self) -> BrnchResult<Vec<ProjectRecord>>;

    fn remove_project(&self, project: &ProjectId) -> BrnchResult<()>;

    fn add_workspace(
        &self,
        project: &ProjectId,
        directory: &str,
        branch_name: &str,
    ) -> BrnchResult<WorkspaceRecord>;

    fn list_workspaces(&self, project: &ProjectId) -> BrnchResult<Vec<WorkspaceRecord>>;

    fn find_workspace(&self, workspace: &WorkspaceId) -> BrnchResult<Option<WorkspaceRecord>>;

    fn remove_workspace(&self, workspace: &WorkspaceId) -> BrnchResult<()>;

    fn save_view(&self, project: &ProjectId, view: &ProjectView) -> BrnchResult<()>;

    fn load_view(&self, project: &ProjectId) -> BrnchResult<Option<ProjectView>>;

    /// Makes the project the active one and moves it to the front of the list.
    fn activate_project(&self, project: &ProjectId) -> BrnchResult<()>;

    fn active_project(&self) -> BrnchResult<Option<ProjectId>>;
}
