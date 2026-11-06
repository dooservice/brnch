//! Calls a running gitd (`make integration` starts one): a token is kept, listed without its
//! secret and forgotten.

use brnch_core::BrnchSettings;
use brnch_core::workspace::{CredentialVault, StoredCredentialKind};
use brnch_gitd::GitdWorkspaceProvider;

#[tokio::test]
#[ignore = "needs a running gitd; run it with make integration"]
async fn a_token_is_kept_by_gitd_listed_and_forgotten() {
    let vault = GitdWorkspaceProvider::connect(BrnchSettings::default())
        .await
        .expect("a gitd answers on GITD_SOCKET");

    let stored = vault
        .store_token("https://github.com/brnch-test-org", "not-a-real-token")
        .await
        .expect("gitd keeps a token that names its host");
    assert_eq!(stored.kind, StoredCredentialKind::Token);
    assert_eq!(stored.url_prefix, "https://github.com/brnch-test-org");

    let listed = vault.list_credentials().await.unwrap();
    assert!(
        listed
            .iter()
            .any(|credential| credential.identifier == stored.identifier)
    );

    vault.forget_credential(&stored.identifier).await.unwrap();
    let after = vault.list_credentials().await.unwrap();
    assert!(
        !after
            .iter()
            .any(|credential| credential.identifier == stored.identifier)
    );
}

#[tokio::test]
#[ignore = "needs a running gitd; run it with make integration"]
async fn a_token_without_a_host_is_refused() {
    let vault = GitdWorkspaceProvider::connect(BrnchSettings::default())
        .await
        .expect("a gitd answers on GITD_SOCKET");

    assert!(vault.store_token("", "not-a-real-token").await.is_err());
}
