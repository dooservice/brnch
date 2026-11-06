use crate::AgentEvent;

/// Understands one agent's output format. It only reads text, so it can be tested with
/// recorded lines and never needs the agent installed.
pub trait OutputNormalizer: Send + Sync {
    fn normalize_line(&self, line: &str) -> Vec<AgentEvent>;
}
