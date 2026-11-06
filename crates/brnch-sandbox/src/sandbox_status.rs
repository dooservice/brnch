use serde::Serialize;

/// Whether agents can be confined on this system, and why not when they cannot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SandboxStatus {
    pub available: bool,
    pub mechanism: String,
    pub reason: Option<String>,
}
