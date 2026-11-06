use super::{StoredEvent, WorkspaceId};
use crate::BrnchResult;

/// Durable memory of what each workspace's agent did, append only.
pub trait EventHistoryStore {
    /// Adds an event and returns the position it got, starting at 1 for each workspace.
    fn append_event(&self, workspace: &WorkspaceId, event_json: &str) -> BrnchResult<u64>;

    /// Every event after `after_sequence`, oldest first.
    fn list_events(
        &self,
        workspace: &WorkspaceId,
        after_sequence: u64,
    ) -> BrnchResult<Vec<StoredEvent>>;
}
