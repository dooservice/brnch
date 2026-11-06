use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex, PoisonError};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use brnch_core::{BrnchError, BrnchResult};
use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::Serialize;
use uuid::Uuid;

use crate::{TerminalListener, TerminalOutput};

const BACKLOG_LIMIT: usize = 256 * 1024;
const READ_CHUNK: usize = 8 * 1024;

/// A terminal that is open: what to write to, how to resize it and what it printed lately.
struct Session {
    identifier: String,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    backlog: Arc<Mutex<Vec<u8>>>,
}

/// What the window gets when it opens or comes back to a workspace's terminal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAttachment {
    pub terminal_identifier: String,
    pub backlog_base64: String,
}

/// One shell per workspace, kept alive while the application runs so leaving the tab does not
/// lose it. What it printed lately is kept to draw it again when the person returns.
pub struct TerminalService {
    sessions: Mutex<HashMap<String, Session>>,
    listener: Arc<dyn TerminalListener>,
}

impl TerminalService {
    pub fn new(listener: Arc<dyn TerminalListener>) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            listener,
        }
    }

    /// Opens the workspace's terminal, or reattaches to the one already open.
    pub fn attach(
        &self,
        workspace_identifier: &str,
        directory: &Path,
        rows: u16,
        columns: u16,
    ) -> BrnchResult<TerminalAttachment> {
        let mut sessions = self.lock();
        if let Some(session) = sessions.get(workspace_identifier) {
            return Ok(Self::attachment_of(session));
        }
        let session = self.start(directory, rows, columns)?;
        let attachment = Self::attachment_of(&session);
        sessions.insert(workspace_identifier.to_owned(), session);
        Ok(attachment)
    }

    pub fn write(&self, workspace_identifier: &str, data: &[u8]) -> BrnchResult<()> {
        let mut sessions = self.lock();
        let session = Self::find(&mut sessions, workspace_identifier)?;
        session
            .writer
            .write_all(data)
            .and_then(|()| session.writer.flush())
            .map_err(|failure| BrnchError::AgentProcess(failure.to_string()))
    }

    pub fn resize(&self, workspace_identifier: &str, rows: u16, columns: u16) -> BrnchResult<()> {
        let mut sessions = self.lock();
        let session = Self::find(&mut sessions, workspace_identifier)?;
        session
            .master
            .resize(Self::size(rows, columns))
            .map_err(|failure| BrnchError::AgentProcess(failure.to_string()))
    }

    /// Ends the workspace's terminal; the next `attach` starts a new one.
    pub fn close(&self, workspace_identifier: &str) {
        if let Some(mut session) = self.lock().remove(workspace_identifier) {
            let _ = session.child.kill();
        }
    }

    fn start(&self, directory: &Path, rows: u16, columns: u16) -> BrnchResult<Session> {
        let failure = |reason: &dyn std::fmt::Display| BrnchError::AgentProcess(reason.to_string());
        let pair = native_pty_system()
            .openpty(Self::size(rows, columns))
            .map_err(|reason| failure(&reason))?;
        let mut command = CommandBuilder::new(Self::shell());
        command.cwd(directory);
        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|reason| failure(&reason))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|reason| failure(&reason))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|reason| failure(&reason))?;
        let identifier = Uuid::new_v4().to_string();
        let backlog = Arc::new(Mutex::new(Vec::new()));
        let kept = Arc::clone(&backlog);
        let listener = Arc::clone(&self.listener);
        let announced = identifier.clone();
        std::thread::spawn(move || {
            let mut chunk = [0_u8; READ_CHUNK];
            while let Ok(count) = reader.read(&mut chunk) {
                if count == 0 {
                    break;
                }
                let bytes = &chunk[..count];
                Self::remember(&kept, bytes);
                listener.output(TerminalOutput {
                    terminal_identifier: announced.clone(),
                    data_base64: STANDARD.encode(bytes),
                });
            }
        });
        Ok(Session {
            identifier,
            master: pair.master,
            writer,
            child,
            backlog,
        })
    }

    fn remember(backlog: &Mutex<Vec<u8>>, bytes: &[u8]) {
        let mut kept = backlog.lock().unwrap_or_else(PoisonError::into_inner);
        kept.extend_from_slice(bytes);
        if kept.len() > BACKLOG_LIMIT {
            let excess = kept.len() - BACKLOG_LIMIT;
            kept.drain(..excess);
        }
    }

    fn attachment_of(session: &Session) -> TerminalAttachment {
        let backlog = session
            .backlog
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        TerminalAttachment {
            terminal_identifier: session.identifier.clone(),
            backlog_base64: STANDARD.encode(backlog.as_slice()),
        }
    }

    fn find<'sessions>(
        sessions: &'sessions mut HashMap<String, Session>,
        workspace_identifier: &str,
    ) -> BrnchResult<&'sessions mut Session> {
        sessions.get_mut(workspace_identifier).ok_or_else(|| {
            BrnchError::AgentProcess("this workspace has no open terminal".to_owned())
        })
    }

    fn shell() -> String {
        if cfg!(windows) {
            "powershell.exe".to_owned()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "sh".to_owned())
        }
    }

    fn size(rows: u16, columns: u16) -> PtySize {
        PtySize {
            rows: rows.max(1),
            cols: columns.max(1),
            pixel_width: 0,
            pixel_height: 0,
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, Session>> {
        self.sessions.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
