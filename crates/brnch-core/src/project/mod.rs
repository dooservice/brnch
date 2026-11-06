//! The projects a person works on, and everything brnch remembers about each one.

mod project_id;
mod project_record;
mod project_store;
mod project_view;
mod workspace_id;
mod workspace_record;

pub use project_id::ProjectId;
pub use project_record::ProjectRecord;
pub use project_store::ProjectStore;
pub use project_view::ProjectView;
pub use workspace_id::WorkspaceId;
pub use workspace_record::WorkspaceRecord;
