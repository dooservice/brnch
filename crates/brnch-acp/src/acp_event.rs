/// How far a tool call has got.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolProgress {
    Pending,
    Running,
    Completed,
    Failed,
}

/// What an agent tells the person while it works.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AcpEvent {
    /// A piece of the agent's answer.
    Message(String),
    /// A piece of the agent's reasoning.
    Thought(String),
    /// The agent started or updated a tool call, such as editing a file or running a command.
    Tool {
        identifier: String,
        title: String,
        progress: ToolProgress,
    },
    /// The agent's plan, with every step as it stands now.
    Plan(Vec<String>),
    /// The agent asked to do something and the policy answered.
    PermissionAnswered { title: String, allowed: bool },
}
