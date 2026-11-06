use brnch_core::workspace::{
    AgentWorkspace, ConflictAnalyzer, PublishedBranch, WorkspaceConflict, WorkspaceDiff,
    WorkspaceProvider, WorkspaceRequest,
};
use brnch_core::{BrnchResult, BrnchSettings};
use gitd::proto::side::Of;
use gitd::{DiffOptions, Gitd, Options, PrepareOptions, PublishOptions, Side};

use crate::gitd_failure_translator::GitdFailureTranslator;

/// A [`WorkspaceProvider`] backed by a running gitd, reached as the environment says
/// (`GITD_URL`, then `GITD_SOCKET`, then gitd's default socket).
pub struct GitdWorkspaceProvider {
    gitd: Gitd,
    settings: BrnchSettings,
}

impl GitdWorkspaceProvider {
    pub async fn connect(settings: BrnchSettings) -> BrnchResult<Self> {
        let gitd = Gitd::connect(Options::new())
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))?;
        // The channel connects lazily, so only a real call shows whether gitd answers.
        gitd.info()
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))?;
        Ok(Self { gitd, settings })
    }
}

impl WorkspaceProvider for GitdWorkspaceProvider {
    async fn prepare(&self, request: &WorkspaceRequest) -> BrnchResult<AgentWorkspace> {
        let options = PrepareOptions {
            new_branch: Some(request.branch_name.clone()),
            branch: request.base_branch.clone(),
            ..PrepareOptions::default()
        };
        let prepared = self
            .gitd
            .prepare(&request.repository_url, &request.directory, options)
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))?;
        Ok(AgentWorkspace {
            directory: request.directory.clone(),
            base_commit: prepared.commit,
        })
    }

    async fn read_diff(&self, workspace: &AgentWorkspace) -> BrnchResult<WorkspaceDiff> {
        let options = DiffOptions {
            max_bytes: self.settings.maximum_diff_bytes,
            ..DiffOptions::default()
        };
        let diff = self
            .gitd
            .diff(&workspace.directory, options)
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))?;
        Ok(WorkspaceDiff {
            unified_diff: diff.diff,
            was_truncated: diff.truncated,
        })
    }

    async fn publish(
        &self,
        workspace: &AgentWorkspace,
        branch_name: &str,
    ) -> BrnchResult<PublishedBranch> {
        let published = self
            .gitd
            .publish(&workspace.directory, branch_name, PublishOptions::default())
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))?;
        Ok(PublishedBranch {
            name: published.branch,
        })
    }

    async fn remove(&self, workspace: &AgentWorkspace) -> BrnchResult<()> {
        self.gitd
            .remove(&workspace.directory)
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))
    }
}

impl ConflictAnalyzer for GitdWorkspaceProvider {
    async fn find_conflicts(
        &self,
        workspaces: &[AgentWorkspace],
    ) -> BrnchResult<Vec<WorkspaceConflict>> {
        let sides = workspaces
            .iter()
            .map(|workspace| Side {
                of: Some(Of::Workspace(workspace.directory.clone())),
            })
            .collect();
        let conflicts = self
            .gitd
            .conflicts(sides, String::new())
            .await
            .map_err(|failure| GitdFailureTranslator::translate(&failure))?;
        Ok(conflicts
            .into_iter()
            .map(|conflict| WorkspaceConflict {
                first_directory: Self::workspace_path(conflict.first),
                second_directory: Self::workspace_path(conflict.second),
                clashing_paths: conflict.paths,
            })
            .collect())
    }
}

impl GitdWorkspaceProvider {
    fn workspace_path(side: Option<Side>) -> String {
        match side.and_then(|side| side.of) {
            Some(Of::Workspace(path) | Of::Branch(path)) => path,
            None => String::new(),
        }
    }
}
