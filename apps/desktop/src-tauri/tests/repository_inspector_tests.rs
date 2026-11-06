use std::process::Command;

use brnch_desktop::RepositoryInspector;

#[test]
fn the_default_branch_and_the_branches_are_read_from_the_listing() {
    let listing =
        "ref: refs/heads/main\tHEAD\n3f9a\tHEAD\n3f9a\trefs/heads/main\n77aa\trefs/heads/develop\n";

    let inspection = RepositoryInspector::parse_listing(listing);

    assert!(inspection.accessible);
    assert_eq!(inspection.default_branch.as_deref(), Some("main"));
    assert_eq!(inspection.branches, ["develop", "main"]);
}

fn git(directory: &std::path::Path, arguments: &[&str]) {
    let status = Command::new("git")
        .args(["-c", "user.name=t", "-c", "user.email=t@example.com"])
        .args(arguments)
        .current_dir(directory)
        .status()
        .expect("git runs");
    assert!(status.success(), "git {arguments:?} failed");
}

#[tokio::test]
async fn a_real_repository_answers_with_its_branches_and_a_missing_one_says_why() {
    let directory = std::env::temp_dir().join(format!("brnch-inspect-{}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    git(&directory, &["init", "-q", "-b", "trunk"]);
    git(
        &directory,
        &["commit", "-q", "--allow-empty", "-m", "first"],
    );
    git(&directory, &["branch", "feature"]);

    let found = RepositoryInspector::inspect(directory.to_str().unwrap()).await;
    let missing = RepositoryInspector::inspect("/definitely/not/a/repository").await;

    assert!(found.accessible);
    assert_eq!(found.default_branch.as_deref(), Some("trunk"));
    assert_eq!(found.branches, ["feature", "trunk"]);
    assert!(!missing.accessible);
    assert!(missing.message.is_some());
    std::fs::remove_dir_all(&directory).unwrap();
}

#[tokio::test]
async fn a_local_folder_is_used_through_its_origin_and_refused_without_one() {
    let directory = std::env::temp_dir().join(format!("brnch-local-{}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    git(&directory, &["init", "-q", "-b", "trunk"]);
    git(
        &directory,
        &["commit", "-q", "--allow-empty", "-m", "first"],
    );
    let without_origin = RepositoryInspector::inspect_local(directory.to_str().unwrap()).await;
    git(
        &directory,
        &[
            "remote",
            "add",
            "origin",
            "https://github.com/acme/web-store.git",
        ],
    );

    let with_origin = RepositoryInspector::inspect_local(directory.to_str().unwrap()).await;

    assert!(!without_origin.accessible);
    assert!(without_origin.message.unwrap().contains("no origin"));
    assert!(with_origin.accessible);
    assert_eq!(
        with_origin.remote_url.as_deref(),
        Some("https://github.com/acme/web-store.git")
    );
    assert_eq!(with_origin.default_branch.as_deref(), Some("trunk"));
    assert_eq!(with_origin.branches, ["trunk"]);
    std::fs::remove_dir_all(&directory).unwrap();
}
