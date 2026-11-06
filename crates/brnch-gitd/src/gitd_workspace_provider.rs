use std::path::Path;

use brnch_core::workspace::{
    AgentWorkspace, ConflictAnalyzer, CredentialVault, PublishedBranch, StoredCredential,
    StoredCredentialKind, WorkspaceConflict, WorkspaceDiff, WorkspaceProvider, WorkspaceRequest,
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
        Self::connect_with(settings, Options::new()).await
    }

    /// Connects to the gitd that listens on `socket`, ignoring the environment.
    pub async fn connect_at(settings: BrnchSettings, socket: &Path) -> BrnchResult<Self> {
        Self::connect_with(settings, Options::new().socket(socket)).await
    }

    async fn connect_with(settings: BrnchSettings, options: Options) -> BrnchResult<Self> {
        let gitd = Gitd::connect(options)
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

impl GitdWorkspaceProvider {
    fn stored(connection: gitd::proto::Connection) -> StoredCredential {
        use gitd::proto::connection::Kind;
        let kind = match Kind::try_from(connection.kind) {
            Ok(Kind::Token) => StoredCredentialKind::Token,
            Ok(Kind::SshKey) => StoredCredentialKind::SshKey,
            Ok(Kind::GithubApp) => StoredCredentialKind::GithubApp,
            Ok(Kind::GithubLogin) => StoredCredentialKind::GithubLogin,
            _ => StoredCredentialKind::Other,
        };
        StoredCredential {
            identifier: connection.id,
            kind,
            url_prefix: connection.url_prefix,
            acts_as: connection.acts_as,
        }
    }
}

impl CredentialVault for GitdWorkspaceProvider {
    async fn list_credentials(&self) -> BrnchResult<Vec<StoredCredential>> {
        let response = self
            .gitd
            .connections()
            .list_connections(gitd::proto::ListConnectionsRequest::default())
            .await
            .map_err(|status| GitdFailureTranslator::translate(&gitd::Error::from(status)))?;
        Ok(response
            .into_inner()
            .connections
            .into_iter()
            .map(Self::stored)
            .collect())
    }

    async fn store_token(&self, url_prefix: &str, token: &str) -> BrnchResult<StoredCredential> {
        let response = self
            .gitd
            .connections()
            .add_token(gitd::proto::AddTokenRequest {
                url_prefix: url_prefix.to_owned(),
                token: token.to_owned(),
                user: String::new(),
            })
            .await
            .map_err(|status| GitdFailureTranslator::translate(&gitd::Error::from(status)))?;
        let connection = response.into_inner().connection.ok_or_else(|| {
            brnch_core::BrnchError::WorkspaceProvider("gitd kept no credential".to_owned())
        })?;
        Ok(Self::stored(connection))
    }

    async fn forget_credential(&self, identifier: &str) -> BrnchResult<()> {
        self.gitd
            .connections()
            .remove_connection(gitd::proto::RemoveConnectionRequest {
                id: identifier.to_owned(),
            })
            .await
            .map_err(|status| GitdFailureTranslator::translate(&gitd::Error::from(status)))?;
        Ok(())
    }
}
