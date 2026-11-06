/// An event with the position it got when it was appended. Positions start at 1.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SequencedEvent<Event> {
    pub sequence: u64,
    pub event: Event,
}
