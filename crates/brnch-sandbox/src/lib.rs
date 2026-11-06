//! Starts agents where they cannot read the person's keys, and refuses to start them where
//! that cannot be done. There is no "run it anyway": without a sandbox the agent does not run.

mod bubblewrap_backend;
mod sandbox_backend;
mod sandbox_profile;
mod sandbox_selector;
mod sandboxed_agent_runner;
mod unavailable_backend;
mod windows_account_backend;

pub use bubblewrap_backend::BubblewrapBackend;
pub use sandbox_backend::SandboxBackend;
pub use sandbox_profile::SandboxProfile;
pub use sandbox_selector::SandboxSelector;
pub use sandboxed_agent_runner::SandboxedAgentRunner;
pub use unavailable_backend::UnavailableBackend;
pub use windows_account_backend::WindowsAccountBackend;
