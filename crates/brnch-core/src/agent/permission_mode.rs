use serde::{Deserialize, Serialize};

/// How much an agent may do on its own. A headless agent cannot ask questions, so there is
/// no "ask each time" mode: it would simply stop at the first edit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionMode {
    EditFiles,
    PlanOnly,
}
