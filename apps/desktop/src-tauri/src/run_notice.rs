use serde::Serialize;

/// Tells the window that a workspace's agent did something new.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunNotice {
    pub workspace_identifier: String,
    pub sequence: u64,
    pub event_json: String,
}
