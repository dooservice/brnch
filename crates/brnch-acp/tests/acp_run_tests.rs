//! The client against an agent that runs in the same process, joined by in-memory channels: the
//! agent speaks the protocol like a real one, so nothing here is mocked at the client's side.

use std::sync::{Arc, Mutex};

use agent_client_protocol::v1::schema::{
    AgentCapabilities, ContentBlock, ContentChunk, InitializeRequest, InitializeResponse,
    NewSessionRequest, NewSessionResponse, PermissionOption, PermissionOptionKind, PromptRequest,
    PromptResponse, RequestPermissionOutcome, RequestPermissionRequest, SessionNotification,
    SessionUpdate, StopReason, TextContent, ToolCall, ToolCallStatus, ToolCallUpdate,
    ToolCallUpdateFields,
};
use agent_client_protocol::{Agent, Channel};
use brnch_acp::{
    AcpEvent, AcpListener, AcpRun, AllowEverything, DenyEverything, PermissionPolicy, ToolProgress,
};

#[derive(Default)]
struct Recording {
    events: Mutex<Vec<AcpEvent>>,
}

impl AcpListener for Recording {
    fn received(&self, event: AcpEvent) {
        self.events.lock().unwrap().push(event);
    }
}

/// An agent that answers in two pieces, runs one tool after asking permission for it, and
/// reports the answer it got.
fn working_agent(agent_side: Channel) {
    tokio::spawn(async move {
        Agent
            .v1()
            .on_receive_request(
                async move |initialize: InitializeRequest, responder, _connection| {
                    responder.respond(
                        InitializeResponse::new(initialize.protocol_version)
                            .agent_capabilities(AgentCapabilities::new()),
                    )
                },
                agent_client_protocol::on_receive_request!(),
            )
            .on_receive_request(
                async move |_: NewSessionRequest, responder, _connection| {
                    responder.respond(NewSessionResponse::new("session-1"))
                },
                agent_client_protocol::on_receive_request!(),
            )
            .on_receive_request(
                async move |prompt: PromptRequest, responder, connection| {
                    // Waiting for the client's answer inside the handler would stop the
                    // connection from delivering it, so the work runs as its own task.
                    let task_connection = connection.clone();
                    connection.spawn(async move {
                        let session = prompt.session_id.clone();
                        let say = |text: &str| {
                            SessionNotification::new(
                                session.clone(),
                                SessionUpdate::AgentMessageChunk(ContentChunk::new(
                                    ContentBlock::Text(TextContent::new(text)),
                                )),
                            )
                        };
                        task_connection.send_notification(say("I will edit "))?;
                        task_connection.send_notification(SessionNotification::new(
                            session.clone(),
                            SessionUpdate::ToolCall(ToolCall::new("call-1", "Edit notes.md")),
                        ))?;
                        let asked = task_connection
                            .send_request(RequestPermissionRequest::new(
                                session.clone(),
                                ToolCallUpdate::new(
                                    "call-1",
                                    ToolCallUpdateFields::new().title("Edit notes.md".to_owned()),
                                ),
                                vec![
                                    PermissionOption::new(
                                        "yes",
                                        "Allow",
                                        PermissionOptionKind::AllowOnce,
                                    ),
                                    PermissionOption::new(
                                        "no",
                                        "Reject",
                                        PermissionOptionKind::RejectOnce,
                                    ),
                                ],
                            ))
                            .block_task()
                            .await?;
                        let allowed = matches!(
                            asked.outcome,
                            RequestPermissionOutcome::Selected(ref chosen)
                                if chosen.option_id.to_string() == "yes"
                        );
                        task_connection.send_notification(SessionNotification::new(
                            session.clone(),
                            SessionUpdate::ToolCallUpdate(ToolCallUpdate::new(
                                "call-1",
                                ToolCallUpdateFields::new().status(if allowed {
                                    ToolCallStatus::Completed
                                } else {
                                    ToolCallStatus::Failed
                                }),
                            )),
                        ))?;
                        task_connection.send_notification(say(if allowed {
                            "done"
                        } else {
                            "refused"
                        }))?;
                        responder.respond(PromptResponse::new(StopReason::EndTurn))
                    })
                },
                agent_client_protocol::on_receive_request!(),
            )
            .connect_to(agent_side)
            .await
    });
}

async fn run_with(policy: Arc<dyn PermissionPolicy>) -> (brnch_acp::AcpOutcome, Vec<AcpEvent>) {
    let (client_side, agent_side) = Channel::duplex();
    working_agent(agent_side);
    let recording = Arc::new(Recording::default());
    let acp = AcpRun::new(Arc::clone(&recording) as Arc<dyn AcpListener>, policy);
    let run = acp.execute_over(client_side, std::path::Path::new("/tmp"), "edit the notes");
    let outcome = tokio::time::timeout(std::time::Duration::from_secs(30), run)
        .await
        .expect("the run does not hang")
        .expect("the run works");
    let events = recording.events.lock().unwrap().clone();
    (outcome, events)
}

#[tokio::test(flavor = "multi_thread")]
async fn an_allowed_tool_runs_and_its_progress_is_heard_in_order() {
    let (outcome, events) = run_with(Arc::new(AllowEverything)).await;

    assert_eq!(outcome.stop_reason, "EndTurn");
    assert_eq!(outcome.message, "I will edit done");
    assert!(events.contains(&AcpEvent::PermissionAnswered {
        title: "Edit notes.md".to_owned(),
        allowed: true
    }));
    assert!(events.contains(&AcpEvent::Tool {
        identifier: "call-1".to_owned(),
        title: String::new(),
        progress: ToolProgress::Completed
    }));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_denied_tool_is_refused_and_the_agent_hears_it() {
    let (outcome, events) = run_with(Arc::new(DenyEverything)).await;

    assert_eq!(outcome.message, "I will edit refused");
    assert!(events.contains(&AcpEvent::PermissionAnswered {
        title: "Edit notes.md".to_owned(),
        allowed: false
    }));
}
