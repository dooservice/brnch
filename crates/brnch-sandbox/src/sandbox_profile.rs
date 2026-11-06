/// What the agent is allowed to touch. Everything else, such as `~/.ssh` and the git
/// credential stores, is simply not there for it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SandboxProfile {
    pub workspace_directory: String,
    pub read_only_directories: Vec<String>,
}
