use std::path::Path;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use brnch_core::project::{
    ProjectId, ProjectRecord, ProjectStore, ProjectView, WorkspaceId, WorkspaceRecord,
};
use brnch_core::{BrnchError, BrnchResult};
use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

use crate::schema_migrator::SchemaMigrator;

const ACTIVE_PROJECT_SETTING: &str = "active_project";

/// A [`ProjectStore`] backed by one SQLite file with a single writer.
pub struct SqliteProjectStore {
    connection: Mutex<Connection>,
}

impl SqliteProjectStore {
    pub fn open(path: &Path) -> BrnchResult<Self> {
        Self::prepare(Connection::open(path))
    }

    pub fn open_in_memory() -> BrnchResult<Self> {
        Self::prepare(Connection::open_in_memory())
    }

    fn prepare(opened: rusqlite::Result<Connection>) -> BrnchResult<Self> {
        let mut connection = opened.map_err(Self::failure)?;
        connection
            .pragma_update(None, "foreign_keys", true)
            .map_err(Self::failure)?;
        SchemaMigrator::bring_up_to_date(&mut connection).map_err(Self::failure)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    // Taken by value so it can be passed straight to `map_err`.
    #[allow(clippy::needless_pass_by_value)]
    fn failure(error: rusqlite::Error) -> BrnchError {
        BrnchError::Store(error.to_string())
    }

    fn connection(&self) -> MutexGuard<'_, Connection> {
        self.connection
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    fn now_in_milliseconds() -> i64 {
        let elapsed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
    }

    fn new_identifier() -> String {
        Uuid::new_v4().to_string()
    }

    fn require_project(connection: &Connection, project: &ProjectId) -> BrnchResult<()> {
        let found: Option<i64> = connection
            .query_row(
                "SELECT 1 FROM projects WHERE identifier = ?1",
                [project.as_str()],
                |row| row.get(0),
            )
            .optional()
            .map_err(Self::failure)?;
        found
            .map(|_| ())
            .ok_or_else(|| BrnchError::UnknownProject(project.as_str().to_owned()))
    }
}

impl ProjectStore for SqliteProjectStore {
    fn add_project(&self, name: &str, repository_url: &str) -> BrnchResult<ProjectRecord> {
        let identifier = Self::new_identifier();
        self.connection()
            .execute(
                "INSERT INTO projects (identifier, name, repository_url, last_opened_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![
                    identifier,
                    name,
                    repository_url,
                    Self::now_in_milliseconds()
                ],
            )
            .map_err(Self::failure)?;
        Ok(ProjectRecord {
            identifier: ProjectId::new(&identifier),
            name: name.to_owned(),
            repository_url: repository_url.to_owned(),
        })
    }

    fn list_projects(&self) -> BrnchResult<Vec<ProjectRecord>> {
        let connection = self.connection();
        let mut statement = connection
            .prepare(
                "SELECT identifier, name, repository_url FROM projects
                 ORDER BY last_opened_at DESC, rowid DESC",
            )
            .map_err(Self::failure)?;
        statement
            .query_map([], |row| {
                Ok(ProjectRecord {
                    identifier: ProjectId::new(&row.get::<_, String>(0)?),
                    name: row.get(1)?,
                    repository_url: row.get(2)?,
                })
            })
            .and_then(Iterator::collect)
            .map_err(Self::failure)
    }

    fn remove_project(&self, project: &ProjectId) -> BrnchResult<()> {
        let connection = self.connection();
        Self::require_project(&connection, project)?;
        connection
            .execute(
                "DELETE FROM projects WHERE identifier = ?1",
                [project.as_str()],
            )
            .map_err(Self::failure)?;
        connection
            .execute(
                "DELETE FROM application_session WHERE setting_name = ?1 AND setting_value = ?2",
                params![ACTIVE_PROJECT_SETTING, project.as_str()],
            )
            .map_err(Self::failure)?;
        Ok(())
    }

    fn add_workspace(
        &self,
        project: &ProjectId,
        directory: &str,
        branch_name: &str,
    ) -> BrnchResult<WorkspaceRecord> {
        let connection = self.connection();
        Self::require_project(&connection, project)?;
        let identifier = Self::new_identifier();
        connection
            .execute(
                "INSERT INTO workspaces (identifier, project_identifier, directory, branch_name)
                 VALUES (?1, ?2, ?3, ?4)",
                params![identifier, project.as_str(), directory, branch_name],
            )
            .map_err(Self::failure)?;
        Ok(WorkspaceRecord {
            identifier: WorkspaceId::new(&identifier),
            project_identifier: project.clone(),
            directory: directory.to_owned(),
            branch_name: branch_name.to_owned(),
        })
    }

    fn list_workspaces(&self, project: &ProjectId) -> BrnchResult<Vec<WorkspaceRecord>> {
        let connection = self.connection();
        let mut statement = connection
            .prepare(
                "SELECT identifier, directory, branch_name FROM workspaces
                 WHERE project_identifier = ?1 ORDER BY rowid",
            )
            .map_err(Self::failure)?;
        statement
            .query_map([project.as_str()], |row| {
                Ok(WorkspaceRecord {
                    identifier: WorkspaceId::new(&row.get::<_, String>(0)?),
                    project_identifier: project.clone(),
                    directory: row.get(1)?,
                    branch_name: row.get(2)?,
                })
            })
            .and_then(Iterator::collect)
            .map_err(Self::failure)
    }

    fn remove_workspace(&self, workspace: &WorkspaceId) -> BrnchResult<()> {
        self.connection()
            .execute(
                "DELETE FROM workspaces WHERE identifier = ?1",
                [workspace.as_str()],
            )
            .map_err(Self::failure)?;
        Ok(())
    }

    fn save_view(&self, project: &ProjectId, view: &ProjectView) -> BrnchResult<()> {
        let connection = self.connection();
        Self::require_project(&connection, project)?;
        connection
            .execute(
                "INSERT INTO project_views (project_identifier, layout_version, layout_json)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(project_identifier) DO UPDATE SET
                    layout_version = excluded.layout_version,
                    layout_json = excluded.layout_json",
                params![project.as_str(), view.layout_version, view.layout_json],
            )
            .map_err(Self::failure)?;
        Ok(())
    }

    fn load_view(&self, project: &ProjectId) -> BrnchResult<Option<ProjectView>> {
        self.connection()
            .query_row(
                "SELECT layout_version, layout_json FROM project_views
                 WHERE project_identifier = ?1",
                [project.as_str()],
                |row| {
                    Ok(ProjectView {
                        layout_version: row.get(0)?,
                        layout_json: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(Self::failure)
    }

    fn activate_project(&self, project: &ProjectId) -> BrnchResult<()> {
        let connection = self.connection();
        Self::require_project(&connection, project)?;
        connection
            .execute(
                "UPDATE projects SET last_opened_at = ?2 WHERE identifier = ?1",
                params![project.as_str(), Self::now_in_milliseconds()],
            )
            .map_err(Self::failure)?;
        connection
            .execute(
                "INSERT INTO application_session (setting_name, setting_value) VALUES (?1, ?2)
                 ON CONFLICT(setting_name) DO UPDATE SET setting_value = excluded.setting_value",
                params![ACTIVE_PROJECT_SETTING, project.as_str()],
            )
            .map_err(Self::failure)?;
        Ok(())
    }

    fn active_project(&self) -> BrnchResult<Option<ProjectId>> {
        self.connection()
            .query_row(
                "SELECT setting_value FROM application_session WHERE setting_name = ?1",
                [ACTIVE_PROJECT_SETTING],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map(|found| found.map(|value| ProjectId::new(&value)))
            .map_err(Self::failure)
    }
}
