//! Remembers projects, workspaces and what was open in each, in a SQLite file.

mod schema_migrator;
mod sqlite_project_store;

pub use sqlite_project_store::SqliteProjectStore;
