use std::io;
use std::process::Stdio;

use brnch_core::agent::{
    AgentCommand, AgentOutcome, AgentOutputLine, AgentOutputListener, AgentRunner, OutputStream,
};
use brnch_core::{BrnchError, BrnchResult};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Command;

/// An [`AgentRunner`] that starts the agent as a child process of this one.
pub struct ProcessAgentRunner;

impl ProcessAgentRunner {
    async fn forward_lines<Source: AsyncRead + Unpin>(
        source: Source,
        stream: OutputStream,
        listener: &dyn AgentOutputListener,
    ) -> io::Result<()> {
        let mut lines = BufReader::new(source).lines();
        while let Some(text) = lines.next_line().await? {
            listener.received(AgentOutputLine { stream, text });
        }
        Ok(())
    }

    fn failure(program: &str, cause: &io::Error) -> BrnchError {
        BrnchError::AgentProcess(format!("{program}: {cause}"))
    }
}

impl AgentRunner for ProcessAgentRunner {
    async fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> BrnchResult<AgentOutcome> {
        let mut child = Command::new(&command.program)
            .args(&command.arguments)
            .current_dir(directory)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|cause| Self::failure(&command.program, &cause))?;
        let standard_output = child.stdout.take().expect("stdout was requested as a pipe");
        let standard_error = child.stderr.take().expect("stderr was requested as a pipe");

        let (standard_result, error_result, exit_status) = tokio::join!(
            Self::forward_lines(standard_output, OutputStream::Standard, listener),
            Self::forward_lines(standard_error, OutputStream::Error, listener),
            child.wait(),
        );
        standard_result.map_err(|cause| Self::failure(&command.program, &cause))?;
        error_result.map_err(|cause| Self::failure(&command.program, &cause))?;
        let exit_status = exit_status.map_err(|cause| Self::failure(&command.program, &cause))?;
        Ok(AgentOutcome {
            exit_code: exit_status.code(),
        })
    }
}
