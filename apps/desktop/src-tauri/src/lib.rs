//! The brnch window: a thin Tauri shell. Every rule lives in the crates it calls.

mod desktop_application;
mod project_commands;
mod project_service;
mod project_summary;
mod workspace_summary;

pub use project_service::ProjectService;
pub use project_summary::ProjectSummary;
pub use workspace_summary::WorkspaceSummary;

pub use desktop_application::run;
