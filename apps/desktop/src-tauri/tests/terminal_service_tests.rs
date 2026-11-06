use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use brnch_desktop::{TerminalListener, TerminalOutput, TerminalService};

#[derive(Default)]
struct Recording {
    text: Mutex<String>,
}

impl TerminalListener for Recording {
    fn output(&self, output: TerminalOutput) {
        let bytes = STANDARD.decode(output.data_base64).unwrap();
        self.text
            .lock()
            .unwrap()
            .push_str(&String::from_utf8_lossy(&bytes));
    }
}

fn wait_for(recording: &Recording, expected: &str) {
    for _ in 0..200 {
        if recording.text.lock().unwrap().contains(expected) {
            return;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    panic!(
        "the terminal never printed {expected:?}: {:?}",
        recording.text.lock().unwrap()
    );
}

#[test]
fn a_terminal_runs_what_is_typed_in_the_workspace_folder_and_comes_back_with_its_history() {
    let directory = std::env::temp_dir().join(format!("brnch-terminal-{}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    let recording = Arc::new(Recording::default());
    let service = TerminalService::new(Arc::clone(&recording) as Arc<dyn TerminalListener>);

    let first = service.attach("w1", &directory, 24, 80).unwrap();
    service.write("w1", b"echo brnch-says-hi; pwd\n").unwrap();
    wait_for(&recording, "brnch-says-hi");
    wait_for(&recording, directory.file_name().unwrap().to_str().unwrap());
    service.resize("w1", 30, 100).unwrap();
    let again = service.attach("w1", &directory, 24, 80).unwrap();

    assert_eq!(again.terminal_identifier, first.terminal_identifier);
    let history =
        String::from_utf8_lossy(&STANDARD.decode(&again.backlog_base64).unwrap()).into_owned();
    assert!(history.contains("brnch-says-hi"));
    service.close("w1");
    assert!(service.write("w1", b"x").is_err());
    std::fs::remove_dir_all(&directory).unwrap();
}
