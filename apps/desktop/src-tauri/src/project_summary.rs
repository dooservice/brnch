use brnch_core::project::ProjectRecord;
use serde::Serialize;

/// A project as the interface sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub identifier: String,
    pub name: String,
    pub repository_url: String,
}

impl From<ProjectRecord> for ProjectSummary {
    fn from(record: ProjectRecord) -> Self {
        Self {
            identifier: record.identifier.as_str().to_owned(),
            name: record.name,
            repository_url: record.repository_url,
        }
    }
}
