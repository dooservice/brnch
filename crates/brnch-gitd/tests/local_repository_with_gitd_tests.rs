//! Measured against a real gitd (`make integration` starts one): it refuses a repository given as a
//! local folder. brnch therefore reads the folder's `origin` and gives gitd that URL.

use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;

use brnch_core::BrnchSettings;
use brnch_core::workspace::{WorkspaceProvider, WorkspaceRequest};
use brnch_gitd::GitdWorkspaceProvider;

fn git(directory: &Path, arguments: &[&str]) {
    let status = Command::new("git")
        .args(["-c", "user.name=t", "-c", "user.email=t@example.com"])
        .args(arguments)
        .current_dir(directory)
        .status()
        .expect("git runs");
    assert!(status.success(), "git {arguments:?} failed");
}

#[tokio::test]
#[ignore = "needs a running gitd; run it with make integration"]
async fn gitd_refuses_a_local_folder_as_the_origin_of_a_workspace() {
    let root = env::var("GITD_TEST_ROOT").expect("GITD_TEST_ROOT names a root of gitd's");
    let origin = Path::new(&root).join(format!("local-origin-{}", std::process::id()));
    fs::create_dir_all(&origin).unwrap();
    git(&origin, &["init", "-q", "-b", "main"]);
    fs::write(origin.join("hello.txt"), "from a local repository\n").unwrap();
    git(&origin, &["add", "-A"]);
    git(&origin, &["commit", "-q", "-m", "first"]);
    let provider = GitdWorkspaceProvider::connect(BrnchSettings::default())
        .await
        .expect("a gitd answers on GITD_SOCKET");

    let prepared = provider
        .prepare(&WorkspaceRequest {
            repository_url: origin.to_string_lossy().into_owned(),
            directory: format!("{root}/brnch-local-{}", std::process::id()),
            branch_name: "agents/local".to_owned(),
            base_branch: None,
        })
        .await;

    let failure = prepared.expect_err("gitd was expected to refuse a local folder");
    assert!(failure.to_string().contains("BAD_ADDRESS"), "{failure}");
    fs::remove_dir_all(&origin).unwrap();
}
