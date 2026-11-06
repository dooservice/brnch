use brnch_core::BrnchResult;
use std::sync::Arc;

use brnch_core::project::{
    EventHistoryStore, ProjectId, ProjectStore, ProjectView, RunRecordStore, WorkspaceId,
};

use crate::{ProjectSummary, WorkspaceSummary};

/// What the window can do with projects. Commands call this and nothing else, so it can be
/// tested without a window.
pub struct ProjectService<Store> {
    store: Arc<Store>,
}

impl<Store: ProjectStore> ProjectService<Store> {
    const CURRENT_LAYOUT_VERSION: u32 = 1;

    pub fn new(store: Arc<Store>) -> Self {
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

    /// Adds a project together with where its runs start from and where its workspaces go.
    pub fn add_project_with_settings(
        &self,
        name: &str,
        repository_url: &str,
        base_branch: Option<&str>,
        workspaces_directory: Option<&str>,
    ) -> BrnchResult<ProjectSummary> {
        let mut created = self.store.add_project(name, repository_url)?;
        let base_branch = base_branch.filter(|branch| !branch.trim().is_empty());
        let workspaces_directory = workspaces_directory.filter(|path| !path.trim().is_empty());
        self.store.update_project_settings(
            &created.identifier,
            base_branch,
            workspaces_directory,
        )?;
        created.base_branch = base_branch.map(str::to_owned);
        created.workspaces_directory = workspaces_directory.map(str::to_owned);
        Ok(ProjectSummary::from(created))
    }

    pub fn activate_project(&self, identifier: &str) -> BrnchResult<()> {
        self.store.activate_project(&ProjectId::new(identifier))
    }

    pub fn remove_project(&self, identifier: &str) -> BrnchResult<()> {
        self.store.remove_project(&ProjectId::new(identifier))
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

impl<Store: ProjectStore + EventHistoryStore + RunRecordStore> ProjectService<Store> {
    pub fn list_workspaces(&self, project_identifier: &str) -> BrnchResult<Vec<WorkspaceSummary>> {
        self.store
            .list_workspaces(&ProjectId::new(project_identifier))?
            .into_iter()
            .map(|record| {
                let details = self.store.find_run(&record.identifier)?;
                let last_event = self.store.last_event(&record.identifier)?;
                Ok(WorkspaceSummary::new(
                    record,
                    details.as_ref(),
                    last_event.as_ref(),
                ))
            })
            .collect()
    }

    pub fn list_events(
        &self,
        workspace_identifier: &str,
        after_sequence: u64,
    ) -> BrnchResult<Vec<crate::RunNotice>> {
        let workspace = WorkspaceId::new(workspace_identifier);
        Ok(self
            .store
            .list_events(&workspace, after_sequence)?
            .into_iter()
            .map(|stored| crate::RunNotice {
                workspace_identifier: workspace_identifier.to_owned(),
                sequence: stored.sequence,
                event_json: stored.event_json,
            })
            .collect())
    }
}
