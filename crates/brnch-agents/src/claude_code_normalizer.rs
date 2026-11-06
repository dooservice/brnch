use serde_json::Value;

use crate::{AgentEvent, OutputNormalizer};

const SUMMARY_LIMIT: usize = 200;

/// Reads the lines of `claude --print --output-format stream-json --verbose`.
#[derive(Debug, Default, Clone, Copy)]
pub struct ClaudeCodeNormalizer;

impl OutputNormalizer for ClaudeCodeNormalizer {
    fn normalize_line(&self, line: &str) -> Vec<AgentEvent> {
        let Ok(message) = serde_json::from_str::<Value>(line) else {
            return vec![AgentEvent::UnparsedOutput(line.to_owned())];
        };
        let events = match message["type"].as_str() {
            Some("system") => Self::session_events(&message),
            Some("assistant") => Self::assistant_events(&message),
            Some("user") => Self::tool_result_events(&message),
            Some("result") => Self::finished_events(&message),
            _ => Vec::new(),
        };
        if events.is_empty() && !Self::is_known_without_events(&message) {
            return vec![AgentEvent::UnparsedOutput(line.to_owned())];
        }
        events
    }
}

impl ClaudeCodeNormalizer {
    fn is_known_without_events(message: &Value) -> bool {
        matches!(
            message["type"].as_str(),
            Some("system" | "assistant" | "user" | "result")
        )
    }

    fn session_events(message: &Value) -> Vec<AgentEvent> {
        if message["subtype"].as_str() != Some("init") {
            return Vec::new();
        }
        vec![AgentEvent::SessionStarted {
            session_identifier: Self::text_of(&message["session_id"]),
            model_name: Self::text_of(&message["model"]),
        }]
    }

    fn assistant_events(message: &Value) -> Vec<AgentEvent> {
        let blocks = message["message"]["content"].as_array();
        blocks
            .into_iter()
            .flatten()
            .filter_map(Self::assistant_block_event)
            .collect()
    }

    fn assistant_block_event(block: &Value) -> Option<AgentEvent> {
        match block["type"].as_str()? {
            "text" => Some(AgentEvent::AssistantText(Self::text_of(&block["text"]))),
            "tool_use" => Some(AgentEvent::ToolRequested {
                tool_call_identifier: Self::text_of(&block["id"]),
                tool_name: Self::text_of(&block["name"]),
                input_summary: Self::shorten(&block["input"].to_string()),
            }),
            _ => None,
        }
    }

    fn tool_result_events(message: &Value) -> Vec<AgentEvent> {
        let blocks = message["message"]["content"].as_array();
        blocks
            .into_iter()
            .flatten()
            .filter(|block| block["type"].as_str() == Some("tool_result"))
            .map(|block| AgentEvent::ToolCompleted {
                tool_call_identifier: Self::text_of(&block["tool_use_id"]),
                failed: block["is_error"].as_bool().unwrap_or(false),
            })
            .collect()
    }

    fn finished_events(message: &Value) -> Vec<AgentEvent> {
        vec![AgentEvent::RunFinished {
            succeeded: !message["is_error"].as_bool().unwrap_or(true),
            summary: Self::text_of(&message["result"]),
            cost_in_dollars: message["total_cost_usd"].as_f64(),
            duration_in_milliseconds: message["duration_ms"].as_u64(),
        }]
    }

    fn text_of(value: &Value) -> String {
        value.as_str().unwrap_or_default().to_owned()
    }

    fn shorten(text: &str) -> String {
        text.chars().take(SUMMARY_LIMIT).collect()
    }
}
