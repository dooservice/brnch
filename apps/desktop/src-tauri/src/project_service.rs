use brnch_core::BrnchResult;
use brnch_core::project::{ProjectId, ProjectStore, ProjectView};

use crate::{ProjectSummary, WorkspaceSummary};

/// What the window can do with projects. Commands call this and nothing else, so it can be
/// tested without a window.
pub struct ProjectService<Store> {
    store: Store,
}

impl<Store: ProjectStore> ProjectService<Store> {
    const CURRENT_LAYOUT_VERSION: u32 = 1;

    pub fn new(store: Store) -> Self {
        Self { store }
    }

    pub fn list_projects(&self) -> BrnchResult<Vec<ProjectSummary>> {
        Ok(self
            .store
            .list_projects()?
            .into_iter()
            .map(ProjectSummary::from)
            .collect())
    }

    pub fn active_project_identifier(&self) -> BrnchResult<Option<String>> {
        Ok(self
            .store
            .active_project()?
            .map(|project| project.as_str().to_owned()))
    }

    pub fn add_project(&self, name: &str, repository_url: &str) -> BrnchResult<ProjectSummary> {
        self.store
            .add_project(name, repository_url)
            .map(ProjectSummary::from)
    }

    pub fn activate_project(&self, identifier: &str) -> BrnchResult<()> {
        self.store.activate_project(&ProjectId::new(identifier))
    }

    pub fn remove_project(&self, identifier: &str) -> BrnchResult<()> {
        self.store.remove_project(&ProjectId::new(identifier))
    }

    pub fn list_workspaces(&self, project_identifier: &str) -> BrnchResult<Vec<WorkspaceSummary>> {
        Ok(self
            .store
            .list_workspaces(&ProjectId::new(project_identifier))?
            .into_iter()
            .map(WorkspaceSummary::from)
            .collect())
    }

    pub fn load_view(&self, project_identifier: &str) -> BrnchResult<Option<String>> {
        Ok(self
            .store
            .load_view(&ProjectId::new(project_identifier))?
            .map(|view| view.layout_json))
    }

    pub fn save_view(&self, project_identifier: &str, layout_json: &str) -> BrnchResult<()> {
        self.store.save_view(
            &ProjectId::new(project_identifier),
            &ProjectView {
                layout_version: Self::CURRENT_LAYOUT_VERSION,
                layout_json: layout_json.to_owned(),
            },
        )
    }
}
