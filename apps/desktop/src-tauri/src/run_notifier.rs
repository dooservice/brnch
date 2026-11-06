use crate::RunNotice;

/// Whoever shows run progress, such as the window.
pub trait RunNotifier: Send + Sync {
    fn notify(&self, notice: RunNotice);
}
