use brnch_agents::AgentEvent;
use brnch_core::project::{StoredEvent, WorkspaceRecord, WorkspaceRunDetails};
use serde::Serialize;

/// Where a workspace's agent stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceStatus {
    /// No task was ever started in it.
    Idle,
    Running,
    /// Finished without failing; waiting for a person to review it.
    Done,
    Failed,
}

/// A workspace as the interface sees it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub identifier: String,
    pub directory: String,
    pub branch_name: String,
    pub title: String,
    pub agent_label: String,
    pub run_identifier: Option<String>,
    pub status: WorkspaceStatus,
    pub started_at_milliseconds: Option<i64>,
    pub cost_in_dollars: Option<f64>,
    pub duration_in_milliseconds: Option<u64>,
    pub total_tokens: Option<u64>,
    pub permission_mode: Option<String>,
    pub base_commit: Option<String>,
}

impl WorkspaceSummary {
    pub fn new(
        record: WorkspaceRecord,
        details: Option<&WorkspaceRunDetails>,
        last_event: Option<&StoredEvent>,
    ) -> Self {
        let finish = last_event
            .and_then(|stored| serde_json::from_str::<AgentEvent>(&stored.event_json).ok());
        let (status, cost, duration, tokens) = match (details, finish) {
            (None, _) => (WorkspaceStatus::Idle, None, None, None),
            (
                Some(_),
                Some(AgentEvent::RunFinished {
                    succeeded,
                    cost_in_dollars,
                    duration_in_milliseconds,
                    total_tokens,
                    ..
                }),
            ) => (
                if succeeded {
                    WorkspaceStatus::Done
                } else {
                    WorkspaceStatus::Failed
                },
                cost_in_dollars,
                duration_in_milliseconds,
                total_tokens,
            ),
            (Some(_), _) => (WorkspaceStatus::Running, None, None, None),
        };
        Self {
            identifier: record.identifier.as_str().to_owned(),
            directory: record.directory,
            title: details.map_or_else(|| record.branch_name.clone(), |run| run.title.clone()),
            branch_name: record.branch_name,
            agent_label: details.map_or_else(String::new, |run| Self::agent_label(&run.agent_kind)),
            run_identifier: details.map(|run| run.run_identifier.clone()),
            started_at_milliseconds: details.map(|run| run.started_at_milliseconds),
            status,
            cost_in_dollars: cost,
            duration_in_milliseconds: duration,
            total_tokens: tokens,
            permission_mode: details.map(|run| run.permission_mode.clone()),
            base_commit: details.and_then(|run| run.base_commit.clone()),
        }
    }

    fn agent_label(agent_kind: &str) -> String {
        match agent_kind {
            "claude_code" => "Claude Code".to_owned(),
            other => other.to_owned(),
        }
    }
}
