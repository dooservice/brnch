use brnch_core::agent::AgentDefinition;

use crate::{AgentKind, ClaudeCodeNormalizer, OutputNormalizer};

/// Knows, for each agent, how to start it and how to read what it prints.
#[derive(Debug, Default, Clone, Copy)]
pub struct AgentCatalog;

impl AgentCatalog {
    pub fn definition(&self, kind: AgentKind) -> AgentDefinition {
        match kind {
            AgentKind::ClaudeCode => AgentDefinition::claude_code(),
        }
    }

    pub fn normalizer(&self, kind: AgentKind) -> Box<dyn OutputNormalizer> {
        match kind {
            AgentKind::ClaudeCode => Box::new(ClaudeCodeNormalizer),
        }
    }
}
