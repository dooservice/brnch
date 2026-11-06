use brnch_core::agent::{AgentOutputLine, AgentOutputListener, OutputStream};

use crate::{AgentEvent, EventSink, OutputNormalizer};

/// Sits between a running agent and the rest of brnch: each line it prints becomes events.
pub struct NormalizingListener<'sink> {
    normalizer: Box<dyn OutputNormalizer>,
    sink: &'sink dyn EventSink,
}

impl<'sink> NormalizingListener<'sink> {
    pub fn new(normalizer: Box<dyn OutputNormalizer>, sink: &'sink dyn EventSink) -> Self {
        Self { normalizer, sink }
    }
}

impl AgentOutputListener for NormalizingListener<'_> {
    fn received(&self, line: AgentOutputLine) {
        let events = match line.stream {
            OutputStream::Standard => self.normalizer.normalize_line(&line.text),
            OutputStream::Error => vec![AgentEvent::UnparsedOutput {
                raw_line: line.text,
            }],
        };
        for event in events {
            self.sink.publish(event);
        }
    }
}
