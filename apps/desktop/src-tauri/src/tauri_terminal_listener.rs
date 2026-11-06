use tauri::{AppHandle, Emitter};

use crate::{TerminalListener, TerminalOutput};

const EVENT_NAME: &str = "terminal-output";

/// Sends what a terminal prints to the window as it happens.
pub struct TauriTerminalListener {
    pub application: AppHandle,
}

impl TerminalListener for TauriTerminalListener {
    fn output(&self, output: TerminalOutput) {
        // A window that is closing has nobody left to tell.
        let _ = self.application.emit(EVENT_NAME, output);
    }
}
