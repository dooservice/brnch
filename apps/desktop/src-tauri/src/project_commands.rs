// Tauri hands commands owned arguments and `State`, so they cannot be borrowed.
#![allow(clippy::needless_pass_by_value)]

use brnch_store::SqliteProjectStore;
use tauri::State;

use std::sync::Arc;

use crate::{
    ProjectService, ProjectSummary, RunGateway, RunNotice, RunNotifier, StartRunRequest,
    TauriRunNotifier, WorkspaceSummary,
};

type Service<'service> = State<'service, ProjectService<SqliteProjectStore>>;

fn describe(failure: &brnch_core::BrnchError) -> String {
    failure.to_string()
}

#[tauri::command]
pub fn list_projects(service: Service) -> Result<Vec<ProjectSummary>, String> {
    service
        .list_projects()
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn active_project_identifier(service: Service) -> Result<Option<String>, String> {
    service
        .active_project_identifier()
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn add_project(
    service: Service,
    name: String,
    repository_url: String,
) -> Result<ProjectSummary, String> {
    service
        .add_project(&name, &repository_url)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn activate_project(service: Service, identifier: String) -> Result<(), String> {
    service
        .activate_project(&identifier)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn remove_project(service: Service, identifier: String) -> Result<(), String> {
    service
        .remove_project(&identifier)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn list_workspaces(
    service: Service,
    project_identifier: String,
) -> Result<Vec<WorkspaceSummary>, String> {
    service
        .list_workspaces(&project_identifier)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn load_view(service: Service, project_identifier: String) -> Result<Option<String>, String> {
    service
        .load_view(&project_identifier)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn save_view(
    service: Service,
    project_identifier: String,
    layout_json: String,
) -> Result<(), String> {
    service
        .save_view(&project_identifier, &layout_json)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn start_run(
    application: tauri::AppHandle,
    gateway: State<'_, RunGateway>,
    request: StartRunRequest,
) -> Result<Vec<String>, String> {
    let notifier: Arc<dyn RunNotifier> = Arc::new(TauriRunNotifier { application });
    gateway
        .start(&request, &notifier)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn list_workspace_events(
    service: Service,
    workspace_identifier: String,
    after_sequence: u64,
) -> Result<Vec<RunNotice>, String> {
    service
        .list_events(&workspace_identifier, after_sequence)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn read_workspace_diff(
    gateway: State<'_, RunGateway>,
    workspace_identifier: String,
) -> Result<crate::DiffSummary, String> {
    gateway
        .diff(&workspace_identifier)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn find_project_conflicts(
    gateway: State<'_, RunGateway>,
    project_identifier: String,
) -> Result<Vec<crate::ConflictSummary>, String> {
    gateway
        .conflicts(&project_identifier)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn publish_workspaces(
    gateway: State<'_, RunGateway>,
    workspace_identifiers: Vec<String>,
) -> Result<Vec<crate::PublishOutcome>, String> {
    gateway
        .publish(&workspace_identifiers)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn stop_run(
    application: tauri::AppHandle,
    gateway: State<'_, RunGateway>,
    workspace_identifier: String,
) -> Result<bool, String> {
    let notifier: Arc<dyn RunNotifier> = Arc::new(TauriRunNotifier { application });
    gateway
        .stop(&workspace_identifier, &notifier)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn send_follow_up(
    application: tauri::AppHandle,
    gateway: State<'_, RunGateway>,
    workspace_identifier: String,
    prompt: String,
) -> Result<(), String> {
    let notifier: Arc<dyn RunNotifier> = Arc::new(TauriRunNotifier { application });
    gateway
        .follow_up(&workspace_identifier, &prompt, &notifier)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn sandbox_status(gateway: State<'_, RunGateway>) -> brnch_sandbox::SandboxStatus {
    gateway.sandbox_status()
}

#[tauri::command]
pub async fn detect_agents() -> Vec<crate::AgentInstallation> {
    crate::AgentDetector::detect_all().await
}

#[tauri::command]
pub async fn gitd_status(
    gateway: State<'_, RunGateway>,
) -> Result<crate::run_gateway::GitdStatus, String> {
    Ok(gateway.gitd_status().await)
}
