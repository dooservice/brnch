//! Runs an agent as an operating system process in its workspace, and streams everything it
//! prints to whoever is listening.

mod process_agent_runner;

pub use process_agent_runner::ProcessAgentRunner;
