use serde::Serialize;

/// How much one workspace changed, for the sidebar and the tab badge.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatistics {
    pub workspace_identifier: String,
    pub files: usize,
    pub added: usize,
    pub removed: usize,
}

impl WorkspaceStatistics {
    /// Counts files and changed lines in a unified diff.
    pub fn from_diff(workspace_identifier: &str, unified_diff: &str) -> Self {
        let mut files = 0;
        let mut added = 0;
        let mut removed = 0;
        let mut inside_hunk = false;
        for line in unified_diff.lines() {
            if line.starts_with("diff --git ") {
                files += 1;
                inside_hunk = false;
            } else if line.starts_with("@@") {
                inside_hunk = true;
            } else if inside_hunk && line.starts_with('+') {
                added += 1;
            } else if inside_hunk && line.starts_with('-') {
                removed += 1;
            }
        }
        Self {
            workspace_identifier: workspace_identifier.to_owned(),
            files,
            added,
            removed,
        }
    }
}
