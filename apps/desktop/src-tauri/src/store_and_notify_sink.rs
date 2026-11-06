use std::sync::Arc;

use brnch_agents::{AgentEvent, EventSink};
use brnch_core::project::{EventHistoryStore, WorkspaceId};

use crate::{RunNotice, RunNotifier};

/// Keeps every event of one workspace in the store, then tells the window about it.
pub struct StoreAndNotifySink<Store> {
    pub store: Arc<Store>,
    pub workspace: WorkspaceId,
    pub notifier: Arc<dyn RunNotifier>,
}

impl<Store: EventHistoryStore + Send + Sync> EventSink for StoreAndNotifySink<Store> {
    fn publish(&self, event: AgentEvent) {
        let Ok(event_json) = serde_json::to_string(&event) else {
            return;
        };
        if let Ok(sequence) = self.store.append_event(&self.workspace, &event_json) {
            self.notifier.notify(RunNotice {
                workspace_identifier: self.workspace.as_str().to_owned(),
                sequence,
                event_json,
            });
        }
    }
}
