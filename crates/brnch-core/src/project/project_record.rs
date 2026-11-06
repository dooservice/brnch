use super::ProjectId;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectRecord {
    pub identifier: ProjectId,
    pub name: String,
    pub repository_url: String,
}
