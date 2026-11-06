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
