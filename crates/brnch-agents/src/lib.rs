//! Turns what each agent prints into one common stream of events.

mod agent_catalog;
mod agent_event;
mod agent_kind;
mod claude_code_normalizer;
mod event_sink;
mod normalizing_listener;
mod output_normalizer;

pub use agent_catalog::AgentCatalog;
pub use agent_event::AgentEvent;
pub use agent_kind::AgentKind;
pub use claude_code_normalizer::ClaudeCodeNormalizer;
pub use event_sink::EventSink;
pub use normalizing_listener::NormalizingListener;
pub use output_normalizer::OutputNormalizer;
