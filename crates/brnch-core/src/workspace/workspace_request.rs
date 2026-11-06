/// What an agent run asks of a provider: a repository, where to put it, and the branch the
/// agent's work will live on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceRequest {
    pub repository_url: String,
    pub directory: String,
    pub branch_name: String,
}
