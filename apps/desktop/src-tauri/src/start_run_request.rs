use brnch_agents::AgentKind;
use brnch_core::agent::PermissionMode;
use serde::Deserialize;

/// What the person asks for in "Nueva corrida".
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRunRequest {
    pub project_identifier: String,
    pub run_label: String,
    pub prompt: String,
    pub agent_kind: AgentKind,
    pub permission_mode: PermissionMode,
    pub base_branch: Option<String>,
    pub copies: u32,
}
