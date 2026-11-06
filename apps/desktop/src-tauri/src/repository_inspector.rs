use brnch_process::HiddenWindow;
use std::time::Duration;

use serde::Serialize;
use tokio::process::Command;

const LISTING_TIME: Duration = Duration::from_secs(15);

/// What asking a repository's server told us: whether it answers, its default branch and the
/// branches it has.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInspection {
    pub accessible: bool,
    pub default_branch: Option<String>,
    pub branches: Vec<String>,
    pub message: Option<String>,
    /// For a local folder: the address of its `origin`, which is what gitd is given.
    pub remote_url: Option<String>,
}

/// Checks a repository with `git ls-remote`, which neither downloads it nor asks for a password.
pub struct RepositoryInspector;

impl RepositoryInspector {
    pub async fn inspect(location: &str) -> RepositoryInspection {
        let run = Command::new("git")
            .args(["ls-remote", "--symref", location, "HEAD", "refs/heads/*"])
            .env("GIT_TERMINAL_PROMPT", "0")
            .stdin(std::process::Stdio::null())
            .kill_on_drop(true)
            .hidden_window()
            .output();
        match tokio::time::timeout(LISTING_TIME, run).await {
            Ok(Ok(output)) if output.status.success() => {
                Self::parse_listing(&String::from_utf8_lossy(&output.stdout))
            }
            Ok(Ok(output)) => Self::refused(&String::from_utf8_lossy(&output.stderr)),
            Ok(Err(failure)) => Self::refused(&failure.to_string()),
            Err(_) => Self::refused("the repository did not answer in time"),
        }
    }

    /// A repository in a local folder. gitd only accepts addresses, so what matters is the folder's
    /// `origin`: without one there is nothing to publish to and the folder is refused.
    pub async fn inspect_local(folder: &str) -> RepositoryInspection {
        let origin = Self::git_output(folder, &["remote", "get-url", "origin"]).await;
        let Some(remote_url) = origin.filter(|url| !url.is_empty()) else {
            return Self::refused(
                "this folder is not a git repository, or it has no origin to publish to",
            );
        };
        let branches = Self::git_output(folder, &["branch", "--format=%(refname:short)"])
            .await
            .map(|listing| listing.lines().map(str::to_owned).collect::<Vec<_>>())
            .unwrap_or_default();
        let default_branch = Self::git_output(folder, &["rev-parse", "--abbrev-ref", "HEAD"]).await;
        RepositoryInspection {
            accessible: true,
            default_branch,
            branches,
            message: None,
            remote_url: Some(remote_url),
        }
    }

    async fn git_output(folder: &str, arguments: &[&str]) -> Option<String> {
        let output = tokio::time::timeout(
            LISTING_TIME,
            Command::new("git")
                .args(["-C", folder])
                .args(arguments)
                .stdin(std::process::Stdio::null())
                .kill_on_drop(true)
                .hidden_window()
                .output(),
        )
        .await
        .ok()?
        .ok()?;
        output
            .status
            .success()
            .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
    }

    /// Reads the output of `git ls-remote --symref`: the line `ref: refs/heads/main`, a tab and
    /// `HEAD` names the default branch, and each `refs/heads/...` line a branch.
    pub fn parse_listing(listing: &str) -> RepositoryInspection {
        let mut default_branch = None;
        let mut branches = Vec::new();
        for line in listing.lines() {
            if let Some(symbolic) = line.strip_prefix("ref: refs/heads/") {
                default_branch = symbolic.split('\t').next().map(str::to_owned);
            } else if let Some((_, name)) = line.split_once('\t')
                && let Some(branch) = name.strip_prefix("refs/heads/")
            {
                branches.push(branch.to_owned());
            }
        }
        branches.sort();
        branches.dedup();
        RepositoryInspection {
            accessible: true,
            default_branch,
            branches,
            message: None,
            remote_url: None,
        }
    }

    fn refused(reason: &str) -> RepositoryInspection {
        let first_line = reason.lines().find(|line| !line.trim().is_empty());
        RepositoryInspection {
            accessible: false,
            default_branch: None,
            branches: Vec::new(),
            message: Some(
                first_line
                    .unwrap_or("the repository did not answer")
                    .trim()
                    .to_owned(),
            ),
            remote_url: None,
        }
    }
}
