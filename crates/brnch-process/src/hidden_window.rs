/// Starts a child process without a console window; a window application must not flash one for
/// each program it runs. It does nothing outside Windows.
pub trait HiddenWindow {
    fn hidden_window(&mut self) -> &mut Self;
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

impl HiddenWindow for tokio::process::Command {
    fn hidden_window(&mut self) -> &mut Self {
        #[cfg(windows)]
        self.creation_flags(CREATE_NO_WINDOW);
        self
    }
}

impl HiddenWindow for std::process::Command {
    fn hidden_window(&mut self) -> &mut Self {
        #[cfg(windows)]
        std::os::windows::process::CommandExt::creation_flags(self, CREATE_NO_WINDOW);
        self
    }
}
