use brnch_core::project::WorkspaceRecord;
use serde::Serialize;

/// A workspace as the interface sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub identifier: String,
    pub directory: String,
    pub branch_name: String,
}

impl From<WorkspaceRecord> for WorkspaceSummary {
    fn from(record: WorkspaceRecord) -> Self {
        Self {
            identifier: record.identifier.as_str().to_owned(),
            directory: record.directory,
            branch_name: record.branch_name,
        }
    }
}
