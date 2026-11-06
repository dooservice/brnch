use thiserror::Error;

/// Every failure the core and its adapters report to their callers.
#[derive(Debug, Error)]
pub enum BrnchError {
    #[error("the workspace provider failed: {0}")]
    WorkspaceProvider(String),

    #[error("the agent process failed: {0}")]
    AgentProcess(String),

    #[error("no sandbox is available, so the agent was not started: {0}")]
    SandboxUnavailable(String),

    #[error("the project store failed: {0}")]
    Store(String),

    #[error("there is no project with identifier {0:?}")]
    UnknownProject(String),

    #[error("there is no workspace with identifier {0:?}")]
    UnknownWorkspace(String),

    #[error("a run needs a label")]
    EmptyRunLabel,

    #[error("the run label {0:?} has no letters or digits to name a branch")]
    UnnameableRunLabel(String),
}

pub type BrnchResult<T> = Result<T, BrnchError>;
