use super::StoredCredential;
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
}
