/// One event of a workspace's agent, kept so the history can be reopened. The core does not
/// read the payload; it belongs to the agents crate.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredEvent {
    pub sequence: u64,
    pub event_json: String,
}
