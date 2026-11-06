use rusqlite::Connection;

/// Each entry upgrades the database by one version. Never edit an entry that has shipped:
/// add a new one.
const MIGRATIONS: &[&str] = &[
    "CREATE TABLE projects (
        identifier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        repository_url TEXT NOT NULL,
        last_opened_at INTEGER NOT NULL
    );
    CREATE TABLE workspaces (
        identifier TEXT PRIMARY KEY,
        project_identifier TEXT NOT NULL REFERENCES projects(identifier) ON DELETE CASCADE,
        directory TEXT NOT NULL,
        branch_name TEXT NOT NULL
    );
    CREATE TABLE project_views (
        project_identifier TEXT PRIMARY KEY REFERENCES projects(identifier) ON DELETE CASCADE,
        layout_version INTEGER NOT NULL,
        layout_json TEXT NOT NULL
    );
    CREATE TABLE application_session (
        setting_name TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL
    );",
    "CREATE TABLE workspace_events (
        workspace_identifier TEXT NOT NULL REFERENCES workspaces(identifier) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        PRIMARY KEY (workspace_identifier, sequence)
    );",
];

pub struct SchemaMigrator;

impl SchemaMigrator {
    pub fn bring_up_to_date(connection: &mut Connection) -> rusqlite::Result<()> {
        let current: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        let applied = usize::try_from(current).unwrap_or_default();
        for (index, statements) in MIGRATIONS.iter().enumerate().skip(applied) {
            let transaction = connection.transaction()?;
            transaction.execute_batch(statements)?;
            let version = i64::try_from(index + 1).unwrap_or(i64::MAX);
            transaction.pragma_update(None, "user_version", version)?;
            transaction.commit()?;
        }
        Ok(())
    }
}
