/// Two workspaces that would not merge cleanly, and the files they clash on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceConflict {
    pub first_directory: String,
    pub second_directory: String,
    pub clashing_paths: Vec<String>,
}
