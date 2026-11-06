use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use brnch_core::{BrnchError, BrnchResult};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

const SOCKET_FILE: &str = "gitd.sock";
const CONFIG_FILE: &str = "gitd.toml";
const LOG_FILE: &str = "gitd.log";
const STATE_DIRECTORY: &str = "state";
const READY_MARKER: &str = "gitd listening";
const START_TIMEOUT: Duration = Duration::from_secs(20);
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const LOG_TAIL_LINES: usize = 6;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Runs the gitd that ships with brnch as a process of the person's own, so nothing has to be
/// installed or given administrator rights. Its socket lives in the person's profile, where only
/// they can reach it, and it ends with the application.
pub struct GitdSupervisor {
    program: PathBuf,
    directory: PathBuf,
    roots: Vec<PathBuf>,
    child: Mutex<Option<Child>>,
}

impl GitdSupervisor {
    pub fn new(program: PathBuf, directory: PathBuf, roots: Vec<PathBuf>) -> Self {
        Self {
            program,
            directory,
            roots,
            child: Mutex::new(None),
        }
    }

    pub fn socket(&self) -> PathBuf {
        self.directory.join(SOCKET_FILE)
    }

    /// Starts gitd unless this supervisor already did, and returns the socket it answers on once
    /// it is listening.
    pub async fn ensure_running(&self) -> BrnchResult<PathBuf> {
        let mut child = self.child.lock().await;
        let alive = child
            .as_mut()
            .is_some_and(|running| matches!(running.try_wait(), Ok(None)));
        if !alive {
            *child = Some(self.start().await?);
        }
        Ok(self.socket())
    }

    async fn start(&self) -> BrnchResult<Child> {
        let failure =
            |reason: String| BrnchError::AgentProcess(format!("gitd did not start: {reason}"));
        let state = self.directory.join(STATE_DIRECTORY);
        std::fs::create_dir_all(&state).map_err(|error| failure(error.to_string()))?;
        let config = self.directory.join(CONFIG_FILE);
        std::fs::write(&config, self.configuration(&state)?)
            .map_err(|error| failure(error.to_string()))?;
        let log = self.directory.join(LOG_FILE);
        let _ = std::fs::remove_file(self.socket());
        let output = std::fs::File::create(&log).map_err(|error| failure(error.to_string()))?;
        let errors = output
            .try_clone()
            .map_err(|error| failure(error.to_string()))?;
        let mut command = Command::new(&self.program);
        command
            .arg("serve")
            .arg("--config")
            .arg(&config)
            .stdin(Stdio::null())
            .stdout(output)
            .stderr(errors)
            .kill_on_drop(true);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let mut child = command
            .spawn()
            .map_err(|error| failure(format!("{}: {error}", self.program.display())))?;
        let deadline = tokio::time::Instant::now() + START_TIMEOUT;
        loop {
            if std::fs::read_to_string(&log).is_ok_and(|text| text.contains(READY_MARKER)) {
                return Ok(child);
            }
            if let Ok(Some(status)) = child.try_wait() {
                return Err(failure(format!(
                    "it stopped ({status}). {}",
                    Self::tail(&log)
                )));
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(failure(format!("it never listened. {}", Self::tail(&log))));
            }
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    }

    /// TOML literal strings, so Windows paths need no escaping.
    fn configuration(&self, state: &Path) -> BrnchResult<String> {
        let quote = |path: &Path| -> BrnchResult<String> {
            let text = path.to_string_lossy();
            if text.contains('\'') {
                return Err(BrnchError::AgentProcess(format!(
                    "gitd cannot use the folder {text}: it has a quote in its name"
                )));
            }
            Ok(format!("'{text}'"))
        };
        let roots = self
            .roots
            .iter()
            .map(|root| quote(root))
            .collect::<BrnchResult<Vec<_>>>()?
            .join(", ");
        Ok(format!(
            "socket = {}\nstate = {}\nroots = [{roots}]\n",
            quote(&self.socket())?,
            quote(state)?
        ))
    }

    fn tail(log: &Path) -> String {
        let text = std::fs::read_to_string(log).unwrap_or_default();
        let lines: Vec<&str> = text.lines().collect();
        lines[lines.len().saturating_sub(LOG_TAIL_LINES)..].join(" | ")
    }
}
