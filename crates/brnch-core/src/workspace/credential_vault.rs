use super::{GithubLoginOutcome, GithubLoginPrompt, RepositoryAccess, StoredCredential};
use crate::error::BrnchResult;

/// Where the credentials that publish live. They stay with the provider: brnch hands a secret
/// over once and can only list or forget it afterwards.
pub trait CredentialVault {
    fn list_credentials(&self) -> impl Future<Output = BrnchResult<Vec<StoredCredential>>> + Send;

    fn store_token(
        &self,
        url_prefix: &str,
        token: &str,
    ) -> impl Future<Output = BrnchResult<StoredCredential>> + Send;

    fn forget_credential(&self, identifier: &str) -> impl Future<Output = BrnchResult<()>> + Send;

    /// Starts signing in to GitHub with a code the person enters on github.com.
    fn begin_github_login(&self) -> impl Future<Output = BrnchResult<GithubLoginPrompt>> + Send;

    /// Waits until the person has authorised on GitHub, then keeps the credential.
    fn finish_github_login(
        &self,
        login_identifier: &str,
    ) -> impl Future<Output = BrnchResult<GithubLoginOutcome>> + Send;

    /// Whether the credentials kept open `repository_url`, and what the provider said if not.
    fn check_access(
        &self,
        repository_url: &str,
    ) -> impl Future<Output = BrnchResult<RepositoryAccess>> + Send;
}
