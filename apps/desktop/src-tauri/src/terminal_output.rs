use serde::Serialize;

/// Bytes a terminal printed, sent to the window as they arrive. They are base64 because a program
/// can print half of a character, which text could not carry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutput {
    pub terminal_identifier: String,
    pub data_base64: String,
}

/// Whoever shows terminal output, such as the window.
pub trait TerminalListener: Send + Sync {
    fn output(&self, output: TerminalOutput);
}
