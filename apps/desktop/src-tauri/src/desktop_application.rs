use brnch_store::SqliteProjectStore;
use tauri::Manager;

use std::path::PathBuf;
use std::sync::Arc;

use crate::project_commands;
use crate::{ProjectService, RunGateway};

const DATABASE_FILE: &str = "brnch.sqlite3";
const WORKSPACES_ROOT_VARIABLE: &str = "BRNCH_WORKSPACES_ROOT";
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
            application.manage(RunGateway::new(
                Arc::clone(&store),
                workspaces_root,
                read_only_directories(),
            ));
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
            project_commands::inspect_repository,
            project_commands::workspace_statistics,
        ])
        .run(tauri::generate_context!())
        .expect("the brnch window failed to start");
}
