use serde::{Deserialize, Serialize};

/// The agents brnch can run. Others are added only once their real flags and output have
/// been checked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentKind {
    ClaudeCode,
}
