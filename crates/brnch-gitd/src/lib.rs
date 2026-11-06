//! Gives brnch its workspaces through gitd: instant copy-on-write checkouts that never hold
//! a credential. Nothing outside this crate knows gitd exists.

mod gitd_failure_translator;
mod gitd_workspace_provider;

pub use gitd_workspace_provider::GitdWorkspaceProvider;
