use crate::SequencedEvent;

/// What a reader gets when it asks for everything after a position.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadOutcome<Event> {
    /// Every event after the position, possibly none.
    Events(Vec<SequencedEvent<Event>>),
    /// Some events after the position were already dropped. The reader must reload its state
    /// from the durable store and continue from `oldest_available`.
    Overflowed { oldest_available: u64 },
}
