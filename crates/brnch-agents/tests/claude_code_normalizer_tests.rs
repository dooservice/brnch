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
        AgentEvent::AssistantText {
            text: "I will edit the file.".to_owned(),
        },
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
            total_tokens: None,
        },
    ];

    assert_eq!(events_of_recorded_run(), expected);
}

#[test]
fn a_line_that_is_not_json_is_kept_as_unparsed_output() {
    let events = ClaudeCodeNormalizer.normalize_line("Error: not logged in");

    assert_eq!(
        events,
        vec![AgentEvent::UnparsedOutput {
            raw_line: "Error: not logged in".to_owned()
        }]
    );
}

#[test]
fn an_unknown_message_type_is_kept_as_unparsed_output() {
    let line = r#"{"type":"brand_new_kind","data":1}"#;

    assert_eq!(
        ClaudeCodeNormalizer.normalize_line(line),
        vec![AgentEvent::UnparsedOutput {
            raw_line: line.to_owned()
        }]
    );
}

#[test]
fn the_tokens_the_agent_reports_are_added_up() {
    let line = r#"{"type":"result","is_error":false,"result":"ok","usage":{"input_tokens":1000,"output_tokens":234}}"#;

    let events = ClaudeCodeNormalizer.normalize_line(line);

    assert!(matches!(
        events.as_slice(),
        [AgentEvent::RunFinished {
            total_tokens: Some(1234),
            ..
        }]
    ));
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

mod listener {
    use std::sync::Mutex;

    use brnch_agents::{AgentCatalog, AgentEvent, AgentKind, EventSink, NormalizingListener};
    use brnch_core::agent::{AgentOutputLine, AgentOutputListener, OutputStream};

    #[derive(Default)]
    struct CollectingSink {
        events: Mutex<Vec<AgentEvent>>,
    }

    impl EventSink for CollectingSink {
        fn publish(&self, event: AgentEvent) {
            self.events.lock().unwrap().push(event);
        }
    }

    #[test]
    fn standard_output_is_normalized_and_error_output_is_kept_as_unparsed() {
        let sink = CollectingSink::default();
        let listener =
            NormalizingListener::new(AgentCatalog.normalizer(AgentKind::ClaudeCode), &sink);

        listener.received(AgentOutputLine {
            stream: OutputStream::Standard,
            text: r#"{"type":"result","is_error":false,"result":"done"}"#.to_owned(),
        });
        listener.received(AgentOutputLine {
            stream: OutputStream::Error,
            text: "warning: slow disk".to_owned(),
        });

        let events = sink.events.lock().unwrap();
        assert!(matches!(
            events[0],
            AgentEvent::RunFinished {
                succeeded: true,
                ..
            }
        ));
        assert_eq!(
            events[1],
            AgentEvent::UnparsedOutput {
                raw_line: "warning: slow disk".to_owned()
            }
        );
    }

    #[test]
    fn every_kind_of_event_can_be_written_as_json_and_read_back() {
        let events = vec![
            AgentEvent::UserMessage {
                text: "do it".to_owned(),
            },
            AgentEvent::SessionStarted {
                session_identifier: "s".to_owned(),
                model_name: "m".to_owned(),
            },
            AgentEvent::AssistantText {
                text: "hello".to_owned(),
            },
            AgentEvent::ToolRequested {
                tool_call_identifier: "t".to_owned(),
                tool_name: "Edit".to_owned(),
                input_summary: "{}".to_owned(),
            },
            AgentEvent::ToolCompleted {
                tool_call_identifier: "t".to_owned(),
                failed: false,
            },
            AgentEvent::RunFinished {
                succeeded: true,
                summary: "ok".to_owned(),
                cost_in_dollars: Some(0.1),
                duration_in_milliseconds: Some(5),
                total_tokens: None,
            },
            AgentEvent::UnparsedOutput {
                raw_line: "??".to_owned(),
            },
        ];

        for event in events {
            let json = serde_json::to_string(&event).expect("every variant serializes");
            assert_eq!(serde_json::from_str::<AgentEvent>(&json).unwrap(), event);
        }
    }

    #[test]
    fn events_survive_a_round_trip_through_json() {
        let event = AgentEvent::ToolCompleted {
            tool_call_identifier: "t1".to_owned(),
            failed: true,
        };

        let json = serde_json::to_string(&event).unwrap();

        assert!(json.contains(r#""kind":"tool_completed""#));
        assert_eq!(serde_json::from_str::<AgentEvent>(&json).unwrap(), event);
    }
}
