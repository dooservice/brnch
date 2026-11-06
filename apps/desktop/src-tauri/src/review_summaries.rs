use serde::Serialize;

/// The diff of one workspace, as the window shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffSummary {
    pub unified_diff: String,
    pub was_truncated: bool,
}

/// Two workspaces of a project whose work would not merge cleanly.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictSummary {
    pub first_workspace_identifier: String,
    pub second_workspace_identifier: String,
    pub clashing_paths: Vec<String>,
}

/// What happened to one workspace when publishing: the branch, or why it was not published.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishOutcome {
    pub workspace_identifier: String,
    pub branch_name: Option<String>,
    pub failure: Option<String>,
}
