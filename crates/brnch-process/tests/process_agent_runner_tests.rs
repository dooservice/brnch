use std::sync::Mutex;

use brnch_core::BrnchError;
use brnch_core::agent::{
    AgentCommand, AgentOutputLine, AgentOutputListener, AgentRunner, OutputStream,
};
use brnch_process::ProcessAgentRunner;

#[derive(Default)]
struct CollectingListener {
    lines: Mutex<Vec<AgentOutputLine>>,
}

impl CollectingListener {
    fn texts_of(&self, stream: OutputStream) -> Vec<String> {
        self.lines
            .lock()
            .unwrap()
            .iter()
            .filter(|line| line.stream == stream)
            .map(|line| line.text.clone())
            .collect()
    }
}

impl AgentOutputListener for CollectingListener {
    fn received(&self, line: AgentOutputLine) {
        self.lines.lock().unwrap().push(line);
    }
}

fn shell(script: &str) -> AgentCommand {
    AgentCommand {
        program: "sh".to_owned(),
        arguments: vec!["-c".to_owned(), script.to_owned()],
    }
}

#[tokio::test]
async fn streams_each_output_channel_and_reports_the_exit_code() {
    let listener = CollectingListener::default();

    let outcome = ProcessAgentRunner
        .run(
            &shell("echo first; echo second; echo problem >&2; exit 3"),
            ".",
            &listener,
        )
        .await
        .unwrap();

    assert_eq!(outcome.exit_code, Some(3));
    assert!(!outcome.succeeded());
    assert_eq!(
        listener.texts_of(OutputStream::Standard),
        ["first", "second"]
    );
    assert_eq!(listener.texts_of(OutputStream::Error), ["problem"]);
}

#[tokio::test]
async fn runs_the_agent_in_the_directory_given() {
    let listener = CollectingListener::default();

    ProcessAgentRunner
        .run(&shell("pwd"), "/", &listener)
        .await
        .unwrap();

    assert_eq!(listener.texts_of(OutputStream::Standard), ["/"]);
}

#[tokio::test]
async fn fails_when_the_program_does_not_exist() {
    let command = AgentCommand {
        program: "brnch-no-such-agent".to_owned(),
        arguments: Vec::new(),
    };

    let failure = ProcessAgentRunner
        .run(&command, ".", &CollectingListener::default())
        .await
        .unwrap_err();

    assert!(matches!(failure, BrnchError::AgentProcess(_)));
}
