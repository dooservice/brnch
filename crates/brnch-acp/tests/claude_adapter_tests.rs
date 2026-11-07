//! Against the real adapter that wraps Claude Code (`npx` fetches it; CI has Node). With no
//! credential it must still answer the protocol and say it needs one; with `ANTHROPIC_API_KEY`
//! it answers the prompt.

use std::path::PathBuf;
use std::sync::Arc;

use brnch_acp::{AcpAgentCommand, AcpEvent, AcpListener, AcpRun, AllowEverything};

struct Silent;

impl AcpListener for Silent {
    fn received(&self, _: AcpEvent) {}
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "needs Node and network; run in CI with the acp job"]
async fn the_claude_adapter_speaks_acp_and_asks_for_a_credential_when_it_has_none() {
    let workspace = std::env::temp_dir().join(format!("brnch-acp-{}", std::process::id()));
    std::fs::create_dir_all(&workspace).unwrap();
    let key = std::env::var("ANTHROPIC_API_KEY").ok();
    let environment = key
        .iter()
        .map(|value| ("ANTHROPIC_API_KEY".to_owned(), value.clone()))
        .collect();
    let command = AcpAgentCommand {
        program: PathBuf::from("npx"),
        arguments: vec![
            "-y".to_owned(),
            "@agentclientprotocol/claude-agent-acp".to_owned(),
        ],
        environment,
    };
    let acp = AcpRun::new(Arc::new(Silent), Arc::new(AllowEverything));

    let outcome = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        acp.execute(command, &workspace, "Reply with the single word pong"),
    )
    .await
    .expect("the adapter answers in time");

    match (key, outcome) {
        (Some(_), Ok(answer)) => assert!(
            answer.message.to_lowercase().contains("pong"),
            "{}",
            answer.message
        ),
        (None, Err(failure)) => {
            let text = failure.to_string().to_lowercase();
            assert!(
                ["login", "auth", "credential", "api key", "sign in"]
                    .iter()
                    .any(|word| text.contains(word)),
                "an unexpected failure: {text}"
            );
        }
        (None, Ok(answer)) => assert!(
            answer.message.to_lowercase().contains("login"),
            "{}",
            answer.message
        ),
        (Some(_), Err(failure)) => panic!("with a key the prompt failed: {failure}"),
    }
    std::fs::remove_dir_all(&workspace).unwrap();
}
