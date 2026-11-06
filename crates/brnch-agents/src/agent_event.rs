use serde::{Deserialize, Serialize};

/// Something an agent did, in the same shape for every agent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AgentEvent {
    /// What the person asked, recorded when a run or a follow-up starts.
    UserMessage {
        text: String,
    },
    SessionStarted {
        session_identifier: String,
        model_name: String,
    },
    AssistantText {
        text: String,
    },
    ToolRequested {
        tool_call_identifier: String,
        tool_name: String,
        input_summary: String,
    },
    ToolCompleted {
        tool_call_identifier: String,
        failed: bool,
    },
    RunFinished {
        succeeded: bool,
        summary: String,
        cost_in_dollars: Option<f64>,
        duration_in_milliseconds: Option<u64>,
    },
    /// A line the normalizer did not understand. Kept so a format change is visible, not lost.
    UnparsedOutput {
        raw_line: String,
    },
}
