/// The program and arguments that start an agent on one prompt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentCommand {
    pub program: String,
    pub arguments: Vec<String>,
}
