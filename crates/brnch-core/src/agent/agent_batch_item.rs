use super::{AgentDefinition, AgentOutputListener, AgentRunRequest};

/// One agent of a batch, with whoever wants to watch its output.
pub struct AgentBatchItem<'item> {
    pub agent: AgentDefinition,
    pub request: AgentRunRequest,
    pub listener: &'item dyn AgentOutputListener,
}
