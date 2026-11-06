//! The isolated copy of a repository each agent works in.

mod agent_workspace;
mod branch_namer;
mod published_branch;
mod workspace_diff;
mod workspace_provider;
mod workspace_request;

pub use agent_workspace::AgentWorkspace;
pub use branch_namer::BranchNamer;
pub use published_branch::PublishedBranch;
pub use workspace_diff::WorkspaceDiff;
pub use workspace_provider::WorkspaceProvider;
pub use workspace_request::WorkspaceRequest;
