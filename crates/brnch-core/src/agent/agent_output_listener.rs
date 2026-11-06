use super::AgentOutputLine;

/// Whoever wants to see an agent's output as it is printed, such as the terminal on screen.
pub trait AgentOutputListener: Sync {
    fn received(&self, line: AgentOutputLine);
}
