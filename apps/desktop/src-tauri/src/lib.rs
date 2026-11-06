//! The brnch window: a thin Tauri shell. Every rule lives in the crates it calls.

mod agent_detector;
mod desktop_application;
mod interrupted_runs;
mod project_commands;
mod project_service;
mod project_summary;
mod repository_inspector;
mod review_service;
mod review_summaries;
pub(crate) mod run_gateway;
mod run_notice;
mod run_notifier;
mod run_service;
mod start_run_request;
mod store_and_notify_sink;
mod tauri_run_notifier;
mod workspace_statistics;
mod workspace_summary;

pub use project_service::ProjectService;
pub use project_summary::ProjectSummary;
pub use repository_inspector::{RepositoryInspection, RepositoryInspector};
pub use review_service::ReviewService;
pub use review_summaries::{ConflictSummary, DiffSummary, PublishOutcome};
pub use run_gateway::RunGateway;
pub use run_notice::RunNotice;
pub use run_notifier::RunNotifier;
pub use run_service::RunService;
pub use start_run_request::StartRunRequest;
pub use store_and_notify_sink::StoreAndNotifySink;
pub use tauri_run_notifier::TauriRunNotifier;
pub use workspace_statistics::WorkspaceStatistics;
pub use workspace_summary::{WorkspaceStatus, WorkspaceSummary};

pub use agent_detector::{AgentDetector, AgentInstallation};
pub use desktop_application::run;
pub use interrupted_runs::close_interrupted_runs;
