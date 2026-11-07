//! Drives a coding agent through the Agent Client Protocol: one prompt in a workspace, the
//! agent's messages, tool calls and plan streamed to a listener, and every permission it asks
//! answered by a policy. The protocol itself comes from the official `agent-client-protocol` crate.

mod acp_agent_command;
mod acp_event;
mod acp_listener;
mod acp_outcome;
mod acp_run;
mod permission_policy;

pub use acp_agent_command::AcpAgentCommand;
pub use acp_event::{AcpEvent, ToolProgress};
pub use acp_listener::AcpListener;
pub use acp_outcome::AcpOutcome;
pub use acp_run::AcpRun;
pub use permission_policy::{AllowEverything, DenyEverything, PermissionPolicy};
