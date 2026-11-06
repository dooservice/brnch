use super::OutputStream;

/// One line an agent printed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentOutputLine {
    pub stream: OutputStream,
    pub text: String,
}
