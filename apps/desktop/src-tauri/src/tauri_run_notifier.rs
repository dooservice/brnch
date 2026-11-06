use tauri::{AppHandle, Emitter};

use crate::{RunNotice, RunNotifier};

const EVENT_NAME: &str = "agent-event";

/// Sends run progress to the window as it happens.
pub struct TauriRunNotifier {
    pub application: AppHandle,
}

impl RunNotifier for TauriRunNotifier {
    fn notify(&self, notice: RunNotice) {
        // A window that is closing has nobody left to tell, so a failure is not an error.
        let _ = self.application.emit(EVENT_NAME, notice);
    }
}
