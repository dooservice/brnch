/// Which of the process's two output channels a line came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputStream {
    Standard,
    Error,
}
