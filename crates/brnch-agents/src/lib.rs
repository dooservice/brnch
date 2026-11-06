//! Turns what each agent prints into one common stream of events.

mod agent_event;
mod claude_code_normalizer;
mod output_normalizer;

pub use agent_event::AgentEvent;
pub use claude_code_normalizer::ClaudeCodeNormalizer;
pub use output_normalizer::OutputNormalizer;
