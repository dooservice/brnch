use std::fs;
use std::path::PathBuf;

use brnch_desktop::WorkspaceFiles;

fn workspace(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("brnch-files-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("src/catalog")).unwrap();
    fs::create_dir_all(root.join(".git")).unwrap();
    fs::create_dir_all(root.join("node_modules/dep")).unwrap();
    fs::write(root.join("README.md"), "# Title\nsearch me\n").unwrap();
    fs::write(
        root.join("src/catalog/SearchBox.tsx"),
        "export const x = 1;\n// Search box\n",
    )
    .unwrap();
    fs::write(root.join("src/main.ts"), "main\n").unwrap();
    fs::write(root.join("node_modules/dep/index.js"), "search me too\n").unwrap();
    fs::write(root.join("logo.bin"), [0xff, 0xfe, 0x00, 0x80]).unwrap();
    root
}

#[test]
fn a_folder_lists_folders_first_and_hides_git_and_dependencies() {
    let root = workspace("list");
    let files = WorkspaceFiles::new(&root);

    let names: Vec<String> = files
        .list("")
        .unwrap()
        .into_iter()
        .map(|entry| entry.name)
        .collect();
    let inner: Vec<String> = files
        .list("src")
        .unwrap()
        .into_iter()
        .map(|entry| entry.relative_path)
        .collect();

    assert_eq!(names, ["src", "logo.bin", "README.md"]);
    assert_eq!(inner, ["src/catalog", "src/main.ts"]);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_file_is_read_written_and_told_apart_when_binary() {
    let root = workspace("read");
    let files = WorkspaceFiles::new(&root);

    files.write("src/main.ts", "changed\n").unwrap();

    assert_eq!(files.read("src/main.ts").unwrap().content, "changed\n");
    assert!(files.read("logo.bin").unwrap().is_binary);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn nothing_outside_the_workspace_can_be_reached() {
    let root = workspace("escape");
    fs::write(root.parent().unwrap().join("brnch-secret.txt"), "secret").unwrap();
    let files = WorkspaceFiles::new(&root);

    assert!(files.read("../brnch-secret.txt").is_err());
    assert!(files.write("../brnch-secret.txt", "x").is_err());
    assert!(files.list("..").is_err());
    assert!(files.read("/etc/hostname").is_err());
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(
            root.parent().unwrap().join("brnch-secret.txt"),
            root.join("link.txt"),
        )
        .unwrap();
        assert!(files.read("link.txt").is_err());
    }
    fs::remove_file(root.parent().unwrap().join("brnch-secret.txt")).unwrap();
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn files_and_lines_can_be_searched_without_looking_into_dependencies() {
    let root = workspace("search");
    let files = WorkspaceFiles::new(&root);

    assert_eq!(files.find_files("searchbox"), ["src/catalog/SearchBox.tsx"]);
    let matches = files.find_text("search");
    let found: Vec<(String, usize)> = matches
        .iter()
        .map(|hit| (hit.relative_path.clone(), hit.line))
        .collect();
    assert_eq!(
        found,
        [
            ("README.md".to_owned(), 2),
            ("src/catalog/SearchBox.tsx".to_owned(), 2)
        ]
    );
    assert_eq!(files.find_text("").len(), 0);
    fs::remove_dir_all(&root).unwrap();
}
