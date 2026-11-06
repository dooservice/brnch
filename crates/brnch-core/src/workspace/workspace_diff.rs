/// What an agent changed in its workspace, as a unified diff.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceDiff {
    pub unified_diff: String,
    pub was_truncated: bool,
}
