use std::future::ready;
use std::sync::Mutex;

use brnch_core::agent::{
    AgentBatchCoordinator, AgentBatchItem, AgentCommand, AgentDefinition, AgentOutcome,
    AgentOutputListener, AgentRunRequest, AgentRunner,
};
use brnch_core::workspace::{
    AgentWorkspace, ConflictAnalyzer, PublishedBranch, WorkspaceConflict, WorkspaceDiff,
    WorkspaceProvider, WorkspaceRequest,
};
use brnch_core::{BrnchError, BrnchResult, BrnchSettings};

struct InstantWorkspaceProvider;

impl WorkspaceProvider for InstantWorkspaceProvider {
    fn prepare(
        &self,
        request: &WorkspaceRequest,
    ) -> impl Future<Output = BrnchResult<AgentWorkspace>> + Send {
        ready(Ok(AgentWorkspace {
            directory: request.directory.clone(),
            base_commit: "abc".to_owned(),
        }))
    }

    fn read_diff(
        &self,
        workspace: &AgentWorkspace,
    ) -> impl Future<Output = BrnchResult<WorkspaceDiff>> + Send {
        ready(Ok(WorkspaceDiff {
            unified_diff: format!("+{}", workspace.directory),
            was_truncated: false,
        }))
    }

    fn publish(
        &self,
        workspace: &AgentWorkspace,
        branch_name: &str,
    ) -> impl Future<Output = BrnchResult<PublishedBranch>> + Send {
        ready(Ok(PublishedBranch {
            name: format!("{branch_name}@{}", workspace.directory),
        }))
    }

    fn remove(&self, workspace: &AgentWorkspace) -> impl Future<Output = BrnchResult<()>> + Send {
        ready(if workspace.directory.is_empty() {
            Err(BrnchError::WorkspaceProvider("empty".to_owned()))
        } else {
            Ok(())
        })
    }
}

/// Fails to start in the workspaces named "broken", succeeds elsewhere.
struct PickyAgentRunner;

impl AgentRunner for PickyAgentRunner {
    fn run(
        &self,
        command: &AgentCommand,
        directory: &str,
        listener: &dyn AgentOutputListener,
    ) -> impl Future<Output = BrnchResult<AgentOutcome>> + Send {
        let _ = (command, listener);
        if directory.contains("broken") {
            return ready(Err(BrnchError::AgentProcess("cannot start".to_owned())));
        }
        ready(Ok(AgentOutcome { exit_code: Some(0) }))
    }
}

struct SilentListener;

impl AgentOutputListener for SilentListener {
    fn received(&self, line: brnch_core::agent::AgentOutputLine) {
        let _ = line;
    }
}

#[derive(Default)]
struct RecordingConflictAnalyzer {
    analyzed: Mutex<Vec<Vec<String>>>,
}

impl ConflictAnalyzer for RecordingConflictAnalyzer {
    fn find_conflicts(
        &self,
        workspaces: &[AgentWorkspace],
    ) -> impl Future<Output = BrnchResult<Vec<WorkspaceConflict>>> + Send {
        let directories: Vec<String> = workspaces
            .iter()
            .map(|workspace| workspace.directory.clone())
            .collect();
        self.analyzed.lock().unwrap().push(directories.clone());
        ready(Ok(vec![WorkspaceConflict {
            first_directory: directories[0].clone(),
            second_directory: directories[1].clone(),
            clashing_paths: vec!["src/lib.rs".to_owned()],
        }]))
    }
}

fn item<'item>(
    label: &str,
    directory: &str,
    listener: &'item SilentListener,
) -> AgentBatchItem<'item> {
    AgentBatchItem {
        agent: AgentDefinition::new("Scripted", "agent", &[]),
        request: AgentRunRequest {
            repository_url: "https://example.com/acme/web".to_owned(),
            workspace_directory: directory.to_owned(),
            run_label: label.to_owned(),
            prompt: "work".to_owned(),
        },
        listener,
    }
}

#[tokio::test]
async fn one_failing_agent_does_not_stop_the_others_and_only_finished_ones_are_compared() {
    let settings = BrnchSettings::default();
    let analyzer = RecordingConflictAnalyzer::default();
    let listener = SilentListener;
    let items = [
        item("first task", "/work/one", &listener),
        item("second task", "/work/broken", &listener),
        item("third task", "/work/three", &listener),
    ];

    let report = AgentBatchCoordinator::new(
        &settings,
        &InstantWorkspaceProvider,
        &PickyAgentRunner,
        &analyzer,
    )
    .run(&items)
    .await
    .unwrap();

    assert!(report.runs[0].is_ok());
    assert!(matches!(report.runs[1], Err(BrnchError::AgentProcess(_))));
    assert!(report.runs[2].is_ok());
    assert_eq!(
        *analyzer.analyzed.lock().unwrap(),
        [vec!["/work/one".to_owned(), "/work/three".to_owned()]]
    );
    assert_eq!(report.conflicts[0].clashing_paths, ["src/lib.rs"]);
}

#[tokio::test]
async fn a_single_finished_agent_has_nothing_to_be_compared_with() {
    let settings = BrnchSettings::default();
    let analyzer = RecordingConflictAnalyzer::default();
    let listener = SilentListener;
    let items = [item("only task", "/work/only", &listener)];

    let report = AgentBatchCoordinator::new(
        &settings,
        &InstantWorkspaceProvider,
        &PickyAgentRunner,
        &analyzer,
    )
    .run(&items)
    .await
    .unwrap();

    assert_eq!(report.conflicts, Vec::<WorkspaceConflict>::new());
    assert_eq!(analyzer.analyzed.lock().unwrap().len(), 0);
}
