use super::AgentOutcome;
use crate::workspace::{AgentWorkspace, WorkspaceDiff};

/// What a finished run leaves to review: where the agent worked, how it ended, and what it
/// changed. Nothing is published until a person decides to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentRunReport {
    pub workspace: AgentWorkspace,
    pub branch_name: String,
    pub outcome: AgentOutcome,
    pub diff: WorkspaceDiff,
}
