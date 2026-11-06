/// What a person asks for: an agent to work on a repository with a prompt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentRunRequest {
    pub repository_url: String,
    pub workspace_directory: String,
    pub run_label: String,
    pub prompt: String,
}
