use brnch_store::SqliteProjectStore;
use tauri::Manager;

use crate::ProjectService;
use crate::project_commands;

const DATABASE_FILE: &str = "brnch.sqlite3";

/// Opens the window. Failing to open the store stops the application with a clear message
/// instead of running without memory.
///
/// # Panics
///
/// When the window cannot start.
pub fn run() {
    tauri::Builder::default()
        .setup(|application| {
            let directory = application.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let store = SqliteProjectStore::open(&directory.join(DATABASE_FILE))?;
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
        ])
        .run(tauri::generate_context!())
        .expect("the brnch window failed to start");
}
