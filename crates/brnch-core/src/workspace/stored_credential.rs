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
