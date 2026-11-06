//! The isolated copy of a repository each agent works in.

mod agent_workspace;
mod branch_namer;
mod conflict_analyzer;
mod credential_vault;
mod published_branch;
mod stored_credential;
mod workspace_conflict;
mod workspace_diff;
mod workspace_provider;
mod workspace_request;

pub use agent_workspace::AgentWorkspace;
pub use branch_namer::BranchNamer;
pub use conflict_analyzer::ConflictAnalyzer;
pub use credential_vault::CredentialVault;
pub use published_branch::PublishedBranch;
pub use stored_credential::{StoredCredential, StoredCredentialKind};
pub use workspace_conflict::WorkspaceConflict;
pub use workspace_diff::WorkspaceDiff;
pub use workspace_provider::WorkspaceProvider;
pub use workspace_request::WorkspaceRequest;
