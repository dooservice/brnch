use std::sync::Arc;
use std::time::Duration;

use brnch_events::{EventLog, ReadOutcome, SequencedEvent};

fn sequenced(sequence: u64, event: &'static str) -> SequencedEvent<&'static str> {
    SequencedEvent { sequence, event }
}

#[test]
fn a_reader_gets_only_the_events_after_its_position() {
    let log = EventLog::new(10);
    log.append("first");
    log.append("second");
    log.append("third");

    assert_eq!(
        log.read_after(1),
        ReadOutcome::Events(vec![sequenced(2, "second"), sequenced(3, "third")])
    );
}

#[test]
fn a_reader_that_fell_behind_is_told_to_reload() {
    let log = EventLog::new(2);
    for event in ["a", "b", "c", "d"] {
        log.append(event);
    }

    assert_eq!(
        log.read_after(0),
        ReadOutcome::Overflowed {
            oldest_available: 3
        }
    );
    assert_eq!(
        log.read_after(2),
        ReadOutcome::Events(vec![sequenced(3, "c"), sequenced(4, "d")])
    );
}

#[tokio::test]
async fn waiting_returns_as_soon_as_an_event_is_appended() {
    let log = Arc::new(EventLog::new(10));
    let writer = Arc::clone(&log);
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(20)).await;
        writer.append("late");
    });

    let outcome = tokio::time::timeout(Duration::from_secs(2), log.wait_after(0))
        .await
        .expect("the reader was never woken");

    assert_eq!(outcome, ReadOutcome::Events(vec![sequenced(1, "late")]));
}
