use super::ProjectId;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectRecord {
    pub identifier: ProjectId,
    pub name: String,
    pub repository_url: String,
    /// The branch runs start from unless the person picks another; the repository's default when
    /// `None`.
    pub base_branch: Option<String>,
    /// Where this project's workspaces are created; the application's default folder when `None`.
    pub workspaces_directory: Option<String>,
}
