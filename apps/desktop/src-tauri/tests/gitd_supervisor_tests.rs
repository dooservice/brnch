//! Starts a real gitd, as brnch does when none is installed. `BRNCH_TEST_GITD_PROGRAM` names the
//! gitd program; `make desktop-check` and the Windows CI provide it.

use brnch_core::BrnchSettings;
use brnch_core::workspace::CredentialVault;
use brnch_core::workspace::StoredCredentialKind;
use brnch_desktop::{GitdSupervisor, SshKeyStore};
use brnch_gitd::GitdWorkspaceProvider;

#[tokio::test]
#[ignore = "needs a gitd program; set BRNCH_TEST_GITD_PROGRAM"]
async fn the_shipped_gitd_starts_for_the_person_and_answers_on_its_own_socket() {
    let program = std::env::var("BRNCH_TEST_GITD_PROGRAM").expect("names a gitd program");
    let directory = std::env::temp_dir().join(format!("brnch-gitd-{}", std::process::id()));
    let roots = vec![directory.join("workspaces")];
    let supervisor = GitdSupervisor::new(program.into(), directory.join("gitd"), roots);

    let socket = supervisor.ensure_running().await.expect("gitd starts");
    let again = supervisor
        .ensure_running()
        .await
        .expect("a second call reuses it");
    let provider = GitdWorkspaceProvider::connect_at(BrnchSettings::default(), &socket)
        .await
        .expect("the window can talk to it");

    assert_eq!(socket, again);
    assert_eq!(provider.list_credentials().await.unwrap().len(), 0);
    let _ = std::fs::remove_dir_all(&directory);
}

#[tokio::test]
async fn a_missing_program_is_reported_instead_of_waiting() {
    let directory = std::env::temp_dir().join(format!("brnch-gitd-missing-{}", std::process::id()));
    let supervisor =
        GitdSupervisor::new("brnch-no-such-gitd".into(), directory.clone(), Vec::new());

    let failure = supervisor.ensure_running().await.unwrap_err();

    assert!(failure.to_string().contains("gitd did not start"));
    let _ = std::fs::remove_dir_all(&directory);
}

#[tokio::test]
#[ignore = "needs a gitd program; set BRNCH_TEST_GITD_PROGRAM"]
async fn an_ssh_key_is_declared_to_the_shipped_gitd_and_withdrawn_again() {
    let program = std::env::var("BRNCH_TEST_GITD_PROGRAM").expect("names a gitd program");
    let directory = std::env::temp_dir().join(format!("brnch-gitd-ssh-{}", std::process::id()));
    let supervisor = GitdSupervisor::new(
        program.into(),
        directory.join("gitd"),
        vec![directory.join("workspaces")],
    );
    let keys = SshKeyStore::new(&directory.join("gitd"));
    keys.ensure("brnch test").unwrap();
    let socket = supervisor.ensure_running().await.unwrap();
    let provider = GitdWorkspaceProvider::connect_at(BrnchSettings::default(), &socket)
        .await
        .unwrap();

    supervisor
        .use_ssh_key(Some(&keys.private_key_path()))
        .await
        .unwrap();
    let declared = provider.list_credentials().await.unwrap();
    supervisor.use_ssh_key(None).await.unwrap();
    let withdrawn = provider.list_credentials().await.unwrap();

    assert_eq!(declared.len(), 1);
    assert_eq!(declared[0].kind, StoredCredentialKind::SshKey);
    assert_eq!(declared[0].url_prefix, "https://github.com");
    assert_eq!(withdrawn.len(), 0);
    let _ = std::fs::remove_dir_all(&directory);
}
