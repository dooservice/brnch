use crate::AcpEvent;

/// Whoever wants to hear what the agent does, as it does it.
pub trait AcpListener: Send + Sync {
    fn received(&self, event: AcpEvent);
}
