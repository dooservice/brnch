use brnch_agents::{AgentEvent, ClaudeCodeNormalizer, OutputNormalizer};

const RECORDED_RUN: &str = include_str!("fixtures/claude-stream-json-success.jsonl");

fn events_of_recorded_run() -> Vec<AgentEvent> {
    RECORDED_RUN
        .lines()
        .flat_map(|line| ClaudeCodeNormalizer.normalize_line(line))
        .collect()
}

#[test]
fn a_recorded_run_becomes_the_expected_events_in_order() {
    let expected = vec![
        AgentEvent::SessionStarted {
            session_identifier: "sess-1".to_owned(),
            model_name: "claude-sonnet-5-5".to_owned(),
        },
        AgentEvent::AssistantText("I will edit the file.".to_owned()),
        AgentEvent::ToolRequested {
            tool_call_identifier: "toolu_1".to_owned(),
            tool_name: "Edit".to_owned(),
            input_summary: "{\"file_path\":\"a.txt\"}".to_owned(),
        },
        AgentEvent::ToolCompleted {
            tool_call_identifier: "toolu_1".to_owned(),
            failed: false,
        },
        AgentEvent::ToolCompleted {
            tool_call_identifier: "toolu_2".to_owned(),
            failed: true,
        },
        AgentEvent::RunFinished {
            succeeded: true,
            summary: "Edited a.txt".to_owned(),
            cost_in_dollars: Some(0.0123),
            duration_in_milliseconds: Some(4200),
        },
    ];

    assert_eq!(events_of_recorded_run(), expected);
}

#[test]
fn a_line_that_is_not_json_is_kept_as_unparsed_output() {
    let events = ClaudeCodeNormalizer.normalize_line("Error: not logged in");

    assert_eq!(
        events,
        vec![AgentEvent::UnparsedOutput(
            "Error: not logged in".to_owned()
        )]
    );
}

#[test]
fn an_unknown_message_type_is_kept_as_unparsed_output() {
    let line = r#"{"type":"brand_new_kind","data":1}"#;

    assert_eq!(
        ClaudeCodeNormalizer.normalize_line(line),
        vec![AgentEvent::UnparsedOutput(line.to_owned())]
    );
}

#[test]
fn a_failed_result_is_reported_as_not_succeeded() {
    let line = r#"{"type":"result","subtype":"error_max_turns","is_error":true,"result":"","duration_ms":10}"#;

    let events = ClaudeCodeNormalizer.normalize_line(line);

    assert!(matches!(
        events.as_slice(),
        [AgentEvent::RunFinished {
            succeeded: false,
            cost_in_dollars: None,
            ..
        }]
    ));
}
