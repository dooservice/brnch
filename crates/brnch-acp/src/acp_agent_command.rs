use std::path::PathBuf;

use agent_client_protocol::AcpAgent;
use agent_client_protocol::AcpAgentConfig;

/// The program that speaks ACP, such as the adapter that wraps Claude Code, and what it starts with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcpAgentCommand {
    pub program: PathBuf,
    pub arguments: Vec<String>,
    pub environment: Vec<(String, String)>,
}

impl AcpAgentCommand {
    pub(crate) fn into_agent(self) -> AcpAgent {
        AcpAgent::new(
            AcpAgentConfig::new(self.program)
                .args(self.arguments)
                .envs(self.environment),
        )
    }
}
