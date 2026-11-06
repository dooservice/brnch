use brnch_agents::AgentKind;
use serde::Deserialize;

/// What the person asks for in "Nueva corrida".
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRunRequest {
    pub project_identifier: String,
    pub run_label: String,
    pub prompt: String,
    pub agent_kind: AgentKind,
    pub copies: u32,
}
