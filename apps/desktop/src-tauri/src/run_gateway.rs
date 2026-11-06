use std::path::PathBuf;
use std::sync::Arc;

use brnch_core::workspace::{
    CredentialVault, GithubLoginOutcome, GithubLoginPrompt, RepositoryAccess,
    RepositoryAccessLevel, StoredCredential, StoredCredentialKind,
};
use brnch_core::{BrnchResult, BrnchSettings};
use brnch_gitd::GitdWorkspaceProvider;
use brnch_process::ProcessAgentRunner;
use brnch_sandbox::{SandboxSelector, SandboxStatus, SandboxedAgentRunner};
use brnch_store::SqliteProjectStore;
use tokio::sync::OnceCell;

use crate::WorkspaceStatistics;
use crate::{
    ConflictSummary, DiffSummary, PublishOutcome, ReviewService, RunNotifier, RunService,
    StartRunRequest,
};
use crate::{GitdSupervisor, SshKeyStore};

type RealRunService = RunService<
    GitdWorkspaceProvider,
    SandboxedAgentRunner<ProcessAgentRunner, SandboxSelector>,
    SqliteProjectStore,
>;

struct Connected {
    credentials: Arc<GitdWorkspaceProvider>,
    runs: RealRunService,
    review: ReviewService<GitdWorkspaceProvider, SqliteProjectStore>,
}

/// The answer to "is gitd there?".
#[derive(Debug, Clone, serde::Serialize)]
pub struct GitdStatus {
    pub connected: bool,
    pub message: Option<String>,
}

/// A credential gitd keeps, as the window shows it: never the secret.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialSummary {
    pub identifier: String,
    pub kind: &'static str,
    pub url_prefix: String,
    pub acts_as: String,
}

impl From<StoredCredential> for CredentialSummary {
    fn from(credential: StoredCredential) -> Self {
        let kind = match credential.kind {
            StoredCredentialKind::Token => "token",
            StoredCredentialKind::SshKey => "ssh_key",
            StoredCredentialKind::GithubApp => "github_app",
            StoredCredentialKind::GithubLogin => "github_login",
            StoredCredentialKind::Other => "other",
        };
        Self {
            identifier: credential.identifier,
            kind,
            url_prefix: credential.url_prefix,
            acts_as: credential.acts_as,
        }
    }
}

/// What the person does on GitHub to sign in, as the window shows it.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubLoginSummary {
    pub user_code: String,
    pub verification_url: String,
    pub login_identifier: String,
    pub expires_in_seconds: i32,
}

impl From<GithubLoginPrompt> for GithubLoginSummary {
    fn from(prompt: GithubLoginPrompt) -> Self {
        Self {
            user_code: prompt.user_code,
            verification_url: prompt.verification_url,
            login_identifier: prompt.login_identifier,
            expires_in_seconds: prompt.expires_in_seconds,
        }
    }
}

/// A finished GitHub sign-in: whom gitd acts as, and where to choose the repositories.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubLoginResult {
    pub credential: CredentialSummary,
    pub install_url: String,
}

impl From<GithubLoginOutcome> for GithubLoginResult {
    fn from(outcome: GithubLoginOutcome) -> Self {
        Self {
            credential: outcome.credential.into(),
            install_url: outcome.install_url,
        }
    }
}

/// Whether gitd's credentials open a repository, as the window shows it.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessSummary {
    pub level: &'static str,
    pub default_branch: String,
    pub failure: String,
}

impl From<RepositoryAccess> for AccessSummary {
    fn from(access: RepositoryAccess) -> Self {
        let level = match access.level {
            RepositoryAccessLevel::Public => "public",
            RepositoryAccessLevel::Reachable => "reachable",
            RepositoryAccessLevel::Denied => "denied",
            RepositoryAccessLevel::Unknown => "unknown",
        };
        Self {
            level,
            default_branch: access.default_branch,
            failure: access.failure,
        }
    }
}

/// The public half of this computer's SSH key.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeySummary {
    pub public_key: String,
    pub fingerprint: String,
}

/// What checking the SSH key found, and whether gitd keeps using it.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshVerification {
    pub access: AccessSummary,
    pub enabled: bool,
}

/// Connects to gitd the first time a run is asked for, so the window opens even when gitd
/// is not running yet and the person is told what is missing instead.
pub struct RunGateway {
    store: Arc<SqliteProjectStore>,
    workspaces_root: PathBuf,
    read_only_directories: Vec<String>,
    agent_data_directory: PathBuf,
    gitd_supervisor: Option<GitdSupervisor>,
    ssh_keys: SshKeyStore,
    connected: OnceCell<Connected>,
}

impl RunGateway {
    pub fn new(
        store: Arc<SqliteProjectStore>,
        workspaces_root: PathBuf,
        read_only_directories: Vec<String>,
        agent_data_directory: PathBuf,
    ) -> Self {
        let ssh_keys = SshKeyStore::new(&agent_data_directory.join("gitd"));
        Self {
            store,
            workspaces_root,
            read_only_directories,
            agent_data_directory,
            ssh_keys,
            gitd_supervisor: None,
            connected: OnceCell::new(),
        }
    }

    /// Lets the gateway use the gitd that ships with brnch.
    #[must_use]
    pub fn with_gitd_supervisor(mut self, supervisor: GitdSupervisor) -> Self {
        self.gitd_supervisor = Some(supervisor);
        self
    }

    pub async fn start(
        &self,
        request: &StartRunRequest,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<Vec<String>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        let started = connected.runs.start(request, notifier)?;
        Ok(started
            .into_iter()
            .map(|workspace| workspace.as_str().to_owned())
            .collect())
    }

    pub async fn stop(
        &self,
        workspace_identifier: &str,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<bool> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected.runs.stop(workspace_identifier, notifier))
    }

    pub async fn follow_up(
        &self,
        workspace_identifier: &str,
        prompt: &str,
        notifier: &Arc<dyn RunNotifier>,
    ) -> BrnchResult<()> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected
            .runs
            .follow_up(workspace_identifier, prompt, notifier)
    }

    /// Whether gitd answers. A failure is a normal answer here, not an error: the window shows it.
    pub async fn gitd_status(&self) -> GitdStatus {
        match self.connected.get_or_try_init(|| self.connect()).await {
            Ok(_) => GitdStatus {
                connected: true,
                message: None,
            },
            Err(failure) => GitdStatus {
                connected: false,
                message: Some(failure.to_string()),
            },
        }
    }

    pub async fn list_credentials(&self) -> BrnchResult<Vec<CredentialSummary>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        let credentials = connected.credentials.list_credentials().await?;
        Ok(credentials
            .into_iter()
            .map(CredentialSummary::from)
            .collect())
    }

    /// Hands a token to gitd, which keeps it; brnch never stores it.
    pub async fn store_token(
        &self,
        url_prefix: &str,
        token: &str,
    ) -> BrnchResult<CredentialSummary> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        let stored = connected
            .credentials
            .store_token(url_prefix.trim(), token.trim())
            .await?;
        Ok(stored.into())
    }

    pub async fn begin_github_login(&self) -> BrnchResult<GithubLoginSummary> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected.credentials.begin_github_login().await?.into())
    }

    /// Returns once the person has authorised on GitHub, which can take minutes.
    pub async fn finish_github_login(
        &self,
        login_identifier: &str,
    ) -> BrnchResult<GithubLoginResult> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected
            .credentials
            .finish_github_login(login_identifier)
            .await?
            .into())
    }

    pub async fn check_access(&self, repository_url: &str) -> BrnchResult<AccessSummary> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected
            .credentials
            .check_access(repository_url.trim())
            .await?
            .into())
    }

    fn shipped_gitd(&self) -> BrnchResult<&GitdSupervisor> {
        self.gitd_supervisor.as_ref().ok_or_else(|| {
            brnch_core::BrnchError::WorkspaceProvider(
                "SSH keys need the gitd that ships with brnch, which is not in use here".to_owned(),
            )
        })
    }

    /// Makes this computer's SSH key if there is none yet; gitd does not use it until checked.
    pub fn create_ssh_key(&self) -> BrnchResult<SshKeySummary> {
        self.shipped_gitd()?;
        let computer = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "this computer".to_owned());
        let key = self.ssh_keys.ensure(&format!("brnch · {computer}"))?;
        Ok(SshKeySummary {
            public_key: key.public_key,
            fingerprint: key.fingerprint,
        })
    }

    /// Lets gitd read GitHub with the key, tries `repository_url`, and withdraws the key again if
    /// GitHub does not accept it, since a key GitHub does not know would break every repository.
    pub async fn verify_ssh_key(&self, repository_url: &str) -> BrnchResult<SshVerification> {
        let supervisor = self.shipped_gitd()?;
        supervisor
            .use_ssh_key(Some(&self.ssh_keys.private_key_path()))
            .await?;
        let checked = self.check_access(repository_url).await;
        let accepted = matches!(&checked, Ok(access) if access.level == "reachable" || access.level == "public");
        if !accepted {
            supervisor.use_ssh_key(None).await?;
        }
        Ok(SshVerification {
            access: checked?,
            enabled: accepted,
        })
    }

    pub async fn remove_ssh_key(&self) -> BrnchResult<()> {
        self.shipped_gitd()?.use_ssh_key(None).await?;
        self.ssh_keys.discard();
        Ok(())
    }

    pub async fn forget_credential(&self, identifier: &str) -> BrnchResult<()> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected.credentials.forget_credential(identifier).await
    }

    /// Measures what a confined agent can reach, with a real process.
    pub async fn probe_sandbox(&self, home: &std::path::Path) -> crate::SandboxProbeReport {
        let process = ProcessAgentRunner::new(BrnchSettings::default().git_credential_variables);
        let runner = SandboxedAgentRunner::new(
            process,
            SandboxSelector::for_current_system(&self.agent_data_directory),
            &[],
        );
        crate::SandboxProbe::run(&runner, home).await
    }

    /// Does not need gitd, so the window can show it before anything is connected.
    pub fn sandbox_status(&self) -> SandboxStatus {
        SandboxSelector::for_current_system(&self.agent_data_directory).status()
    }

    pub async fn diff(&self, workspace_identifier: &str) -> BrnchResult<DiffSummary> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected.review.diff(workspace_identifier).await
    }

    pub async fn statistics(
        &self,
        project_identifier: &str,
    ) -> BrnchResult<Vec<WorkspaceStatistics>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected.review.statistics(project_identifier).await
    }

    pub async fn conflicts(&self, project_identifier: &str) -> BrnchResult<Vec<ConflictSummary>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        connected.review.conflicts(project_identifier).await
    }

    pub async fn publish(
        &self,
        workspace_identifiers: &[String],
    ) -> BrnchResult<Vec<PublishOutcome>> {
        let connected = self.connected.get_or_try_init(|| self.connect()).await?;
        Ok(connected.review.publish(workspace_identifiers).await)
    }

    /// The gitd that ships with brnch when there is one, because its folders and its socket are
    /// the person's own; otherwise the one the environment names or the system runs.
    async fn connect_provider(
        &self,
        settings: &BrnchSettings,
    ) -> BrnchResult<GitdWorkspaceProvider> {
        let Some(supervisor) = &self.gitd_supervisor else {
            return GitdWorkspaceProvider::connect(settings.clone()).await;
        };
        let shipped = match supervisor.ensure_running().await {
            Ok(socket) => GitdWorkspaceProvider::connect_at(settings.clone(), &socket).await,
            Err(failure) => Err(failure),
        };
        match shipped {
            Ok(provider) => Ok(provider),
            Err(failure) => GitdWorkspaceProvider::connect(settings.clone())
                .await
                .map_err(|_| failure),
        }
    }

    async fn connect(&self) -> BrnchResult<Connected> {
        let settings = BrnchSettings::default();
        let provider = Arc::new(self.connect_provider(&settings).await?);
        let process = ProcessAgentRunner::new(settings.git_credential_variables);
        let directories: Vec<&str> = self
            .read_only_directories
            .iter()
            .map(String::as_str)
            .collect();
        let runner = SandboxedAgentRunner::new(
            process,
            SandboxSelector::for_current_system(&self.agent_data_directory),
            &directories,
        );
        Ok(Connected {
            credentials: Arc::clone(&provider),
            runs: RunService::new(
                settings,
                Arc::clone(&provider),
                runner,
                Arc::clone(&self.store),
                self.workspaces_root.clone(),
            ),
            review: ReviewService::new(provider, Arc::clone(&self.store)),
        })
    }
}
