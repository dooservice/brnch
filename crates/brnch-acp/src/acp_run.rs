use std::path::Path;
use std::sync::{Arc, Mutex};

use agent_client_protocol::schema::ProtocolVersion;
use agent_client_protocol::v1::ConnectionTo;
use agent_client_protocol::v1::schema::{
    ContentBlock, InitializeRequest, NewSessionRequest, PermissionOptionKind, PromptRequest,
    RequestPermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
    SelectedPermissionOutcome, SessionNotification, SessionUpdate, TextContent, ToolCallStatus,
};
use agent_client_protocol::{Agent, ConnectTo};
use brnch_core::{BrnchError, BrnchResult};

use crate::{AcpAgentCommand, AcpEvent, AcpListener, AcpOutcome, PermissionPolicy, ToolProgress};

/// One prompt run against an ACP agent in a workspace.
pub struct AcpRun {
    listener: Arc<dyn AcpListener>,
    policy: Arc<dyn PermissionPolicy>,
}

impl AcpRun {
    pub fn new(listener: Arc<dyn AcpListener>, policy: Arc<dyn PermissionPolicy>) -> Self {
        Self { listener, policy }
    }

    /// Starts the agent program and runs the prompt in `workspace`.
    pub async fn execute(
        &self,
        command: AcpAgentCommand,
        workspace: &Path,
        prompt: &str,
    ) -> BrnchResult<AcpOutcome> {
        self.execute_over(command.into_agent(), workspace, prompt)
            .await
    }

    /// Runs the prompt over any transport to an agent, such as an in-process one for tests.
    pub async fn execute_over(
        &self,
        agent: impl ConnectTo<agent_client_protocol::Client> + 'static,
        workspace: &Path,
        prompt: &str,
    ) -> BrnchResult<AcpOutcome> {
        let answer = Arc::new(Mutex::new(String::new()));
        let heard = Arc::clone(&self.listener);
        let heard_answer = Arc::clone(&answer);
        let policy = Arc::clone(&self.policy);
        let asked = Arc::clone(&self.listener);
        let workspace = workspace.to_path_buf();
        let prompt = prompt.to_owned();

        let stop_reason = agent_client_protocol::Client
            .v1()
            .on_receive_notification(
                async move |notification: SessionNotification, _connection| {
                    if let Some(event) = Self::event_of(&notification.update) {
                        if let (AcpEvent::Message(text), Ok(mut so_far)) =
                            (&event, heard_answer.lock())
                        {
                            so_far.push_str(text);
                        }
                        heard.received(event);
                    }
                    Ok(())
                },
                agent_client_protocol::on_receive_notification!(),
            )
            .on_receive_request(
                async move |request: RequestPermissionRequest, responder, _connection| {
                    let title = request.tool_call.fields.title.clone().unwrap_or_default();
                    let allowed = policy.allows(&title);
                    asked.received(AcpEvent::PermissionAnswered { title, allowed });
                    responder.respond(RequestPermissionResponse::new(Self::outcome_for(
                        &request, allowed,
                    )))
                },
                agent_client_protocol::on_receive_request!(),
            )
            .connect_with(agent, |connection: ConnectionTo<Agent>| async move {
                connection
                    .send_request(InitializeRequest::new(ProtocolVersion::V1))
                    .block_task()
                    .await?;
                let session = connection
                    .send_request(NewSessionRequest::new(workspace))
                    .block_task()
                    .await?;
                let response = connection
                    .send_request(PromptRequest::new(
                        session.session_id,
                        vec![ContentBlock::Text(TextContent::new(prompt))],
                    ))
                    .block_task()
                    .await?;
                Ok(format!("{:?}", response.stop_reason))
            })
            .await
            .map_err(|failure| BrnchError::AgentProcess(failure.to_string()))?;

        let message = answer.lock().map(|text| text.clone()).unwrap_or_default();
        Ok(AcpOutcome {
            stop_reason,
            message,
        })
    }

    fn event_of(update: &SessionUpdate) -> Option<AcpEvent> {
        match update {
            SessionUpdate::AgentMessageChunk(chunk) => {
                Self::text_of(&chunk.content).map(AcpEvent::Message)
            }
            SessionUpdate::AgentThoughtChunk(chunk) => {
                Self::text_of(&chunk.content).map(AcpEvent::Thought)
            }
            SessionUpdate::ToolCall(call) => Some(AcpEvent::Tool {
                identifier: call.tool_call_id.to_string(),
                title: call.title.clone(),
                progress: Self::progress_of(call.status),
            }),
            SessionUpdate::ToolCallUpdate(update) => Some(AcpEvent::Tool {
                identifier: update.tool_call_id.to_string(),
                title: update.fields.title.clone().unwrap_or_default(),
                progress: update
                    .fields
                    .status
                    .map_or(ToolProgress::Running, Self::progress_of),
            }),
            SessionUpdate::Plan(plan) => Some(AcpEvent::Plan(
                plan.entries
                    .iter()
                    .map(|entry| entry.content.clone())
                    .collect(),
            )),
            _ => None,
        }
    }

    fn text_of(content: &ContentBlock) -> Option<String> {
        match content {
            ContentBlock::Text(text) => Some(text.text.clone()),
            _ => None,
        }
    }

    fn progress_of(status: ToolCallStatus) -> ToolProgress {
        match status {
            ToolCallStatus::Pending => ToolProgress::Pending,
            ToolCallStatus::Completed => ToolProgress::Completed,
            ToolCallStatus::Failed => ToolProgress::Failed,
            _ => ToolProgress::Running, // in progress, and any status a newer protocol adds
        }
    }

    /// The answer to a permission request: the narrowest allowing option, chosen by its kind and
    /// never by its position or name, or a rejection.
    fn outcome_for(request: &RequestPermissionRequest, allowed: bool) -> RequestPermissionOutcome {
        let wanted = if allowed {
            [
                PermissionOptionKind::AllowOnce,
                PermissionOptionKind::AllowAlways,
            ]
        } else {
            [
                PermissionOptionKind::RejectOnce,
                PermissionOptionKind::RejectAlways,
            ]
        };
        wanted
            .iter()
            .find_map(|kind| request.options.iter().find(|option| option.kind == *kind))
            .map_or(RequestPermissionOutcome::Cancelled, |option| {
                RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                    option.option_id.clone(),
                ))
            })
    }
}
