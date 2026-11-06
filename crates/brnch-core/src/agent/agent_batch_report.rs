use super::AgentRunReport;
use crate::error::BrnchResult;
use crate::workspace::WorkspaceConflict;

/// How a batch ended: one result per agent, in the order they were given, and which of the
/// finished ones clash with each other.
#[derive(Debug)]
pub struct AgentBatchReport {
    pub runs: Vec<BrnchResult<AgentRunReport>>,
    pub conflicts: Vec<WorkspaceConflict>,
}
