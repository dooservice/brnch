use super::{AgentCommand, PermissionMode};

/// An agent brnch knows how to start: its name, its program, and the arguments that come
/// before the prompt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentDefinition {
    display_name: String,
    program: String,
    leading_arguments: Vec<String>,
}

impl AgentDefinition {
    pub fn new(display_name: &str, program: &str, leading_arguments: &[&str]) -> Self {
        Self {
            display_name: display_name.to_owned(),
            program: program.to_owned(),
            leading_arguments: leading_arguments
                .iter()
                .map(|argument| (*argument).to_owned())
                .collect(),
        }
    }

    /// Claude Code without an interface, printing one JSON message per line.
    pub fn claude_code(mode: PermissionMode) -> Self {
        let permission = match mode {
            PermissionMode::EditFiles => "acceptEdits",
            PermissionMode::PlanOnly => "plan",
        };
        Self::new(
            "Claude Code",
            "claude",
            &[
                "--print",
                "--output-format",
                "stream-json",
                "--verbose",
                "--permission-mode",
                permission,
            ],
        )
    }

    pub fn display_name(&self) -> &str {
        &self.display_name
    }

    pub fn command_for(&self, prompt: &str) -> AgentCommand {
        let mut arguments = self.leading_arguments.clone();
        arguments.push(prompt.to_owned());
        AgentCommand {
            program: self.program.clone(),
            arguments,
        }
    }

    /// Continues an earlier session of the agent with a new message.
    pub fn command_for_resume(&self, prompt: &str, session_identifier: &str) -> AgentCommand {
        let mut arguments = self.leading_arguments.clone();
        arguments.push("--resume".to_owned());
        arguments.push(session_identifier.to_owned());
        arguments.push(prompt.to_owned());
        AgentCommand {
            program: self.program.clone(),
            arguments,
        }
    }
}
