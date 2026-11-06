use crate::AgentEvent;

/// Whoever wants the events of a run as they happen, such as the store and the window.
pub trait EventSink: Sync {
    fn publish(&self, event: AgentEvent);
}
