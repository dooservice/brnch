//! Running an AI coding agent inside a workspace and reporting what it did.

mod agent_command;
mod agent_definition;
mod agent_outcome;
mod agent_output_line;
mod agent_output_listener;
mod agent_run_coordinator;
mod agent_run_report;
mod agent_run_request;
mod agent_runner;
mod output_stream;

pub use agent_command::AgentCommand;
pub use agent_definition::AgentDefinition;
pub use agent_outcome::AgentOutcome;
pub use agent_output_line::AgentOutputLine;
pub use agent_output_listener::AgentOutputListener;
pub use agent_run_coordinator::AgentRunCoordinator;
pub use agent_run_report::AgentRunReport;
pub use agent_run_request::AgentRunRequest;
pub use agent_runner::AgentRunner;
pub use output_stream::OutputStream;
