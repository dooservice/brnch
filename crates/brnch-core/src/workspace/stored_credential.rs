/// What kind of secret a credential kept for publishing is, never the secret itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StoredCredentialKind {
    Token,
    SshKey,
    GithubApp,
    GithubLogin,
    Other,
}

/// A credential the workspace provider keeps for publishing, as the person may see it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredCredential {
    pub identifier: String,
    pub kind: StoredCredentialKind,
    pub url_prefix: String,
    pub acts_as: String,
}

/// What the person does on GitHub to sign in: enter `user_code` at `verification_url`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubLoginPrompt {
    pub user_code: String,
    pub verification_url: String,
    pub login_identifier: String,
    pub expires_in_seconds: i32,
}

/// A finished sign-in: the credential kept, and where to choose the repositories it may reach.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubLoginOutcome {
    pub credential: StoredCredential,
    pub install_url: String,
}

/// How far the credentials the provider keeps reach into one repository.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RepositoryAccessLevel {
    Public,
    Reachable,
    Denied,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepositoryAccess {
    pub level: RepositoryAccessLevel,
    pub default_branch: String,
    pub failure: String,
}
