use std::collections::VecDeque;
use std::sync::Mutex;

use tokio::sync::Notify;

use crate::{ReadOutcome, SequencedEvent};

/// A bounded log: the newest `capacity` events stay available. A reader that falls behind is
/// told so explicitly instead of silently missing events.
#[derive(Debug)]
pub struct EventLog<Event> {
    capacity: usize,
    retained: Mutex<Retained<Event>>,
    arrival: Notify,
}

#[derive(Debug)]
struct Retained<Event> {
    events: VecDeque<SequencedEvent<Event>>,
    last_sequence: u64,
}

impl<Event: Clone> EventLog<Event> {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity: capacity.max(1),
            retained: Mutex::new(Retained {
                events: VecDeque::new(),
                last_sequence: 0,
            }),
            arrival: Notify::new(),
        }
    }

    pub fn append(&self, event: Event) -> u64 {
        let mut retained = self.lock();
        retained.last_sequence += 1;
        let sequence = retained.last_sequence;
        retained
            .events
            .push_back(SequencedEvent { sequence, event });
        if retained.events.len() > self.capacity {
            retained.events.pop_front();
        }
        drop(retained);
        self.arrival.notify_waiters();
        sequence
    }

    pub fn read_after(&self, after_sequence: u64) -> ReadOutcome<Event> {
        let retained = self.lock();
        if let Some(oldest) = retained.events.front()
            && oldest.sequence > after_sequence + 1
        {
            return ReadOutcome::Overflowed {
                oldest_available: oldest.sequence,
            };
        }
        let newer = retained
            .events
            .iter()
            .filter(|entry| entry.sequence > after_sequence)
            .cloned()
            .collect();
        ReadOutcome::Events(newer)
    }

    /// Waits until something newer than `after_sequence` exists, then returns it.
    pub async fn wait_after(&self, after_sequence: u64) -> ReadOutcome<Event> {
        loop {
            let arrived = self.arrival.notified();
            tokio::pin!(arrived);
            arrived.as_mut().enable();
            match self.read_after(after_sequence) {
                ReadOutcome::Events(events) if events.is_empty() => arrived.await,
                outcome => return outcome,
            }
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Retained<Event>> {
        self.retained
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}
