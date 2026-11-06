/// Why a workspace exists: the task it was given and which agent works on it. Workspaces made
/// by the same run share `run_identifier`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceRunDetails {
    pub run_identifier: String,
    pub agent_kind: String,
    pub permission_mode: String,
    pub title: String,
    pub prompt: String,
    pub started_at_milliseconds: i64,
    /// The commit the workspace was made at; known once gitd has prepared it.
    pub base_commit: Option<String>,
}
