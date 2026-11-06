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

#[tokio::test]
#[ignore = "needs a running gitd and the network; run it with make integration"]
async fn a_github_sign_in_starts_with_a_code_to_enter_on_github() {
    let vault = GitdWorkspaceProvider::connect(BrnchSettings::default())
        .await
        .expect("a gitd answers on GITD_SOCKET");

    let prompt = vault
        .begin_github_login()
        .await
        .expect("gitd starts the sign-in");

    assert_eq!(prompt.verification_url, "https://github.com/login/device");
    assert_eq!(prompt.user_code.len(), 9);
    assert!(prompt.expires_in_seconds > 0);
}

#[tokio::test]
#[ignore = "needs a running gitd and the network; run it with make integration"]
async fn a_public_repository_is_reachable_with_no_credential() {
    let vault = GitdWorkspaceProvider::connect(BrnchSettings::default())
        .await
        .expect("a gitd answers on GITD_SOCKET");

    let access = vault
        .check_access("https://github.com/octocat/Hello-World")
        .await
        .unwrap();

    assert_eq!(
        access.level,
        brnch_core::workspace::RepositoryAccessLevel::Public
    );
    assert_eq!(access.default_branch, "master");
}
