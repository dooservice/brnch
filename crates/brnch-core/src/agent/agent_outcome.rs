/// How an agent's process ended. There is no exit code when a signal ended it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AgentOutcome {
    pub exit_code: Option<i32>,
}

impl AgentOutcome {
    pub fn succeeded(&self) -> bool {
        self.exit_code == Some(0)
    }
}
