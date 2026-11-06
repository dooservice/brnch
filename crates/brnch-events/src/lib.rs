//! Keeps recent events for replay and wakes readers when new ones arrive.

mod event_log;
mod read_outcome;
mod sequenced_event;

pub use event_log::EventLog;
pub use read_outcome::ReadOutcome;
pub use sequenced_event::SequencedEvent;
