use brnch_store::SqliteProjectStore;
use tauri::Manager;

use std::path::PathBuf;
use std::sync::Arc;

use crate::project_commands;
use crate::{ProjectService, RunGateway};

const DATABASE_FILE: &str = "brnch.sqlite3";
const WORKSPACES_ROOT_VARIABLE: &str = "BRNCH_WORKSPACES_ROOT";
const GITD_PROGRAM_VARIABLE: &str = "BRNCH_GITD_PROGRAM";
const READ_ONLY_VARIABLE: &str = "BRNCH_SANDBOX_READ_ONLY";

/// Folders the confined agent may read but not change, such as gitd's pool and the folder
/// where its program is installed. Separated like the system's `PATH`.
fn read_only_directories() -> Vec<String> {
    std::env::var_os(READ_ONLY_VARIABLE)
        .map(|value| {
            std::env::split_paths(&value)
                .map(|path| path.to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default()
}

/// The gitd that ships with brnch, unless the person points gitd somewhere themselves.
fn bundled_gitd(
    application: &tauri::App,
    directory: &std::path::Path,
    roots: Vec<PathBuf>,
) -> Option<crate::GitdSupervisor> {
    if ["GITD_URL", "GITD_SOCKET"]
        .iter()
        .any(|name| std::env::var_os(name).is_some())
    {
        return None;
    }
    let program = std::env::var_os(GITD_PROGRAM_VARIABLE)
        .map(PathBuf::from)
        .or_else(|| {
            let name = if cfg!(windows) {
                "resources/gitd.exe"
            } else {
                "resources/gitd"
            };
            application
                .path()
                .resolve(name, tauri::path::BaseDirectory::Resource)
                .ok()
        })?;
    program
        .is_file()
        .then(|| crate::GitdSupervisor::new(program, directory.join("gitd"), roots))
}

/// Opens the window. Failing to open the store stops the application with a clear message
/// instead of running without memory.
///
/// # Panics
///
/// When the window cannot start.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|application| {
            let directory = application.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let store = Arc::new(SqliteProjectStore::open(&directory.join(DATABASE_FILE))?);
            crate::close_interrupted_runs(&*store)?;
            let workspaces_root = std::env::var_os(WORKSPACES_ROOT_VARIABLE)
                .map_or_else(|| directory.join("workspaces"), PathBuf::from);
            let mut roots = vec![workspaces_root.clone()];
            roots.extend(application.path().home_dir().ok());
            let mut gateway = RunGateway::new(
                Arc::clone(&store),
                workspaces_root,
                read_only_directories(),
                directory.clone(),
            );
            if let Some(supervisor) = bundled_gitd(application, &directory, roots) {
                gateway = gateway.with_gitd_supervisor(supervisor);
            }
            application.manage(gateway);
            application.manage(crate::TerminalService::new(Arc::new(
                crate::TauriTerminalListener {
                    application: application.handle().clone(),
                },
            )));
            application.manage(crate::AgentAccount::new(&directory));
            application.manage(ProjectService::new(store));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project_commands::list_projects,
            project_commands::active_project_identifier,
            project_commands::add_project,
            project_commands::activate_project,
            project_commands::remove_project,
            project_commands::list_workspaces,
            project_commands::load_view,
            project_commands::save_view,
            project_commands::start_run,
            project_commands::list_workspace_events,
            project_commands::read_workspace_diff,
            project_commands::find_project_conflicts,
            project_commands::publish_workspaces,
            project_commands::stop_run,
            project_commands::send_follow_up,
            project_commands::sandbox_status,
            project_commands::detect_agents,
            project_commands::gitd_status,
            project_commands::list_git_credentials,
            project_commands::add_git_token,
            project_commands::remove_git_credential,
            project_commands::probe_sandbox,
            project_commands::setup_agent_account,
            project_commands::set_agent_api_key,
            project_commands::inspect_repository,
            project_commands::inspect_local_repository,
            project_commands::workspace_statistics,
            project_commands::list_workspace_files,
            project_commands::read_workspace_file,
            project_commands::write_workspace_file,
            project_commands::find_workspace_files,
            project_commands::find_workspace_text,
            project_commands::open_terminal,
            project_commands::write_terminal,
            project_commands::resize_terminal,
            project_commands::close_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("the brnch window failed to start");
}
