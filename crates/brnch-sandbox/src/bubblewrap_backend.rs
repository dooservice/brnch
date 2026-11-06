use brnch_core::BrnchResult;
use brnch_core::agent::AgentCommand;

use crate::{SandboxBackend, SandboxProfile};

const PROGRAM: &str = "bwrap";
const SYSTEM_READ_ONLY_DIRECTORIES: [&str; 2] = ["/usr", "/etc"];
const SYSTEM_LINKS: [(&str, &str); 3] = [
    ("usr/bin", "/bin"),
    ("usr/lib", "/lib"),
    ("usr/lib64", "/lib64"),
];
const HOME_INSIDE_SANDBOX: &str = "/nonexistent";

/// Linux: bubblewrap shows the agent a tiny filesystem with only the system, the workspace
/// and what the profile adds. The home directory is not part of it.
#[derive(Debug, Default, Clone, Copy)]
pub struct BubblewrapBackend;

impl SandboxBackend for BubblewrapBackend {
    fn confine(
        &self,
        command: &AgentCommand,
        profile: &SandboxProfile,
    ) -> BrnchResult<AgentCommand> {
        let mut arguments = Vec::new();
        for directory in SYSTEM_READ_ONLY_DIRECTORIES {
            arguments.extend(["--ro-bind", directory, directory].map(str::to_owned));
        }
        for (target, link) in SYSTEM_LINKS {
            arguments.extend(["--symlink", target, link].map(str::to_owned));
        }
        arguments
            .extend(["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp"].map(str::to_owned));
        for directory in &profile.read_only_directories {
            arguments.extend(["--ro-bind".to_owned(), directory.clone(), directory.clone()]);
        }
        let workspace = &profile.workspace_directory;
        arguments.extend(["--bind".to_owned(), workspace.clone(), workspace.clone()]);
        arguments.extend(["--chdir".to_owned(), workspace.clone()]);
        arguments.extend(["--unshare-pid", "--die-with-parent"].map(str::to_owned));
        arguments.extend(["--setenv", "HOME", HOME_INSIDE_SANDBOX].map(str::to_owned));
        arguments.push(command.program.clone());
        arguments.extend(command.arguments.iter().cloned());
        Ok(AgentCommand {
            program: PROGRAM.to_owned(),
            arguments,
        })
    }
}
