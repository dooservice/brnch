//! Runs an agent as an operating system process in its workspace, and streams everything it
//! prints to whoever is listening.

mod hidden_window;
mod process_agent_runner;

pub use hidden_window::HiddenWindow;
pub use process_agent_runner::ProcessAgentRunner;
