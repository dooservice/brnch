use super::{AgentCommand, AgentOutcome, AgentOutputListener};
use crate::error::BrnchResult;

/// Starts an agent's command in a directory and waits for it to end, telling the listener
/// every line it prints.
pub trait AgentRunner {
    fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> impl Future<Output = BrnchResult<AgentOutcome>> + Send;
}
