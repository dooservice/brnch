/// A workspace that exists on disk, ready for an agent to work in.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentWorkspace {
    pub directory: String,
    pub base_commit: String,
}
