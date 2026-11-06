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
    base_branch: Option<String>,
    workspaces_directory: Option<String>,
) -> Result<ProjectSummary, String> {
    service
        .add_project_with_settings(
            &name,
            &repository_url,
            base_branch.as_deref(),
            workspaces_directory.as_deref(),
        )
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

#[tauri::command]
pub async fn list_git_credentials(
    gateway: State<'_, RunGateway>,
) -> Result<Vec<crate::run_gateway::CredentialSummary>, String> {
    gateway
        .list_credentials()
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn add_git_token(
    gateway: State<'_, RunGateway>,
    url_prefix: String,
    token: String,
) -> Result<crate::run_gateway::CredentialSummary, String> {
    gateway
        .store_token(&url_prefix, &token)
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn start_github_login(
    gateway: State<'_, RunGateway>,
) -> Result<crate::run_gateway::GithubLoginSummary, String> {
    gateway
        .begin_github_login()
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn finish_github_login(
    gateway: State<'_, RunGateway>,
    login_identifier: String,
) -> Result<crate::run_gateway::GithubLoginResult, String> {
    gateway
        .finish_github_login(&login_identifier)
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn check_repository_access(
    gateway: State<'_, RunGateway>,
    repository_url: String,
) -> Result<crate::run_gateway::AccessSummary, String> {
    gateway
        .check_access(&repository_url)
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub fn create_ssh_key(
    gateway: State<'_, RunGateway>,
) -> Result<crate::run_gateway::SshKeySummary, String> {
    gateway
        .create_ssh_key()
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn verify_ssh_key(
    gateway: State<'_, RunGateway>,
    repository_url: String,
) -> Result<crate::run_gateway::SshVerification, String> {
    gateway
        .verify_ssh_key(&repository_url)
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn remove_ssh_key(gateway: State<'_, RunGateway>) -> Result<(), String> {
    gateway
        .remove_ssh_key()
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn remove_git_credential(
    gateway: State<'_, RunGateway>,
    identifier: String,
) -> Result<(), String> {
    gateway
        .forget_credential(&identifier)
        .await
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub async fn inspect_repository(location: String) -> crate::RepositoryInspection {
    crate::RepositoryInspector::inspect(&location).await
}

#[tauri::command]
pub async fn inspect_local_repository(folder: String) -> crate::RepositoryInspection {
    crate::RepositoryInspector::inspect_local(&folder).await
}

#[tauri::command]
pub async fn workspace_statistics(
    gateway: State<'_, RunGateway>,
    project_identifier: String,
) -> Result<Vec<crate::WorkspaceStatistics>, String> {
    gateway
        .statistics(&project_identifier)
        .await
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn open_terminal(
    service: Service,
    terminals: State<'_, crate::TerminalService>,
    workspace_identifier: String,
    rows: u16,
    columns: u16,
) -> Result<crate::TerminalAttachment, String> {
    let directory = service
        .workspace_directory(&workspace_identifier)
        .map_err(|failure| describe(&failure))?;
    terminals
        .attach(&workspace_identifier, &directory, rows, columns)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn write_terminal(
    terminals: State<'_, crate::TerminalService>,
    workspace_identifier: String,
    data_base64: String,
) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|failure| failure.to_string())?;
    terminals
        .write(&workspace_identifier, &bytes)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn resize_terminal(
    terminals: State<'_, crate::TerminalService>,
    workspace_identifier: String,
    rows: u16,
    columns: u16,
) -> Result<(), String> {
    terminals
        .resize(&workspace_identifier, rows, columns)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn close_terminal(terminals: State<'_, crate::TerminalService>, workspace_identifier: String) {
    terminals.close(&workspace_identifier);
}

fn files_of(
    service: &Service,
    workspace_identifier: &str,
) -> Result<crate::WorkspaceFiles, String> {
    service
        .workspace_directory(workspace_identifier)
        .map(|directory| crate::WorkspaceFiles::new(&directory))
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn list_workspace_files(
    service: Service,
    workspace_identifier: String,
    relative_path: String,
) -> Result<Vec<crate::FileEntry>, String> {
    files_of(&service, &workspace_identifier)?
        .list(&relative_path)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn read_workspace_file(
    service: Service,
    workspace_identifier: String,
    relative_path: String,
) -> Result<crate::FileContent, String> {
    files_of(&service, &workspace_identifier)?
        .read(&relative_path)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn write_workspace_file(
    service: Service,
    workspace_identifier: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    files_of(&service, &workspace_identifier)?
        .write(&relative_path, &content)
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub fn find_workspace_files(
    service: Service,
    workspace_identifier: String,
    query: String,
) -> Result<Vec<String>, String> {
    Ok(files_of(&service, &workspace_identifier)?.find_files(&query))
}

#[tauri::command]
pub fn find_workspace_text(
    service: Service,
    workspace_identifier: String,
    query: String,
) -> Result<Vec<crate::TextMatch>, String> {
    Ok(files_of(&service, &workspace_identifier)?.find_text(&query))
}

#[tauri::command]
pub async fn setup_agent_account(
    account: State<'_, crate::AgentAccount>,
) -> Result<brnch_sandbox::SandboxStatus, String> {
    let account = account.inner().clone();
    tauri::async_runtime::spawn_blocking(move || account.set_up())
        .await
        .map_err(|failure| failure.to_string())?
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn set_agent_api_key(
    account: State<'_, crate::AgentAccount>,
    api_key: Option<String>,
) -> Result<(), String> {
    let account = account.inner().clone();
    tauri::async_runtime::spawn_blocking(move || account.set_api_key(api_key.as_deref()))
        .await
        .map_err(|failure| failure.to_string())?
        .map_err(|failure| describe(&failure))
}

#[tauri::command]
pub async fn probe_sandbox(
    application: tauri::AppHandle,
    gateway: State<'_, RunGateway>,
) -> Result<crate::SandboxProbeReport, String> {
    use tauri::Manager;
    let home = application
        .path()
        .home_dir()
        .map_err(|failure| failure.to_string())?;
    Ok(gateway.probe_sandbox(&home).await)
}
