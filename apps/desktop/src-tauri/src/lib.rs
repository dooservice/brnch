//! The brnch window: a thin Tauri shell. Every rule lives in the crates it calls.

mod desktop_application;
mod project_commands;
mod project_service;
mod project_summary;
mod review_service;
mod review_summaries;
mod run_gateway;
mod run_notice;
mod run_notifier;
mod run_service;
mod start_run_request;
mod store_and_notify_sink;
mod tauri_run_notifier;
mod workspace_summary;

pub use project_service::ProjectService;
pub use project_summary::ProjectSummary;
pub use review_service::ReviewService;
pub use review_summaries::{ConflictSummary, DiffSummary, PublishOutcome};
pub use run_gateway::RunGateway;
pub use run_notice::RunNotice;
pub use run_notifier::RunNotifier;
pub use run_service::RunService;
pub use start_run_request::StartRunRequest;
pub use store_and_notify_sink::StoreAndNotifySink;
pub use tauri_run_notifier::TauriRunNotifier;
pub use workspace_summary::WorkspaceSummary;

pub use desktop_application::run;
