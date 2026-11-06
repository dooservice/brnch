use std::fs;
use std::path::{Component, Path, PathBuf};

use brnch_core::{BrnchError, BrnchResult};
use serde::Serialize;

const MAXIMUM_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAXIMUM_SEARCH_RESULTS: usize = 200;
const SKIPPED_FOLDERS: [&str; 4] = [".git", "node_modules", "target", "dist"];

/// One entry of a folder, as the file tree shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub relative_path: String,
    pub is_directory: bool,
}

/// What opening a file gives: its text, or the reason there is none.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub is_binary: bool,
    pub is_too_large: bool,
}

/// A line of a file that matches a search.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMatch {
    pub relative_path: String,
    pub line: usize,
    pub text: String,
}

/// Reads and writes the files of one workspace folder, and never anything outside it.
pub struct WorkspaceFiles {
    root: PathBuf,
}

impl WorkspaceFiles {
    pub fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
        }
    }

    /// The entries of a folder, folders first, without the folders that are not source code.
    pub fn list(&self, relative: &str) -> BrnchResult<Vec<FileEntry>> {
        let folder = self.resolve(relative)?;
        let mut entries = Vec::new();
        for entry in fs::read_dir(&folder).map_err(Self::failure)? {
            let entry = entry.map_err(Self::failure)?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let is_directory = entry.file_type().map_err(Self::failure)?.is_dir();
            if is_directory && SKIPPED_FOLDERS.contains(&name.as_str()) {
                continue;
            }
            entries.push(FileEntry {
                relative_path: Self::join(relative, &name),
                name,
                is_directory,
            });
        }
        entries.sort_by(|first, second| {
            second
                .is_directory
                .cmp(&first.is_directory)
                .then_with(|| first.name.to_lowercase().cmp(&second.name.to_lowercase()))
        });
        Ok(entries)
    }

    pub fn read(&self, relative: &str) -> BrnchResult<FileContent> {
        let path = self.resolve(relative)?;
        let size = fs::metadata(&path).map_err(Self::failure)?.len();
        if size > MAXIMUM_FILE_BYTES {
            return Ok(FileContent {
                content: String::new(),
                is_binary: false,
                is_too_large: true,
            });
        }
        let bytes = fs::read(&path).map_err(Self::failure)?;
        match String::from_utf8(bytes) {
            Ok(content) => Ok(FileContent {
                content,
                is_binary: false,
                is_too_large: false,
            }),
            Err(_) => Ok(FileContent {
                content: String::new(),
                is_binary: true,
                is_too_large: false,
            }),
        }
    }

    pub fn write(&self, relative: &str, content: &str) -> BrnchResult<()> {
        let path = self.resolve(relative)?;
        fs::write(path, content).map_err(Self::failure)
    }

    /// Files whose path contains the text, for "go to file".
    pub fn find_files(&self, query: &str) -> Vec<String> {
        let needle = query.to_lowercase();
        let mut found = Vec::new();
        Self::walk(&self.root, &mut |path| {
            let relative = self.relative_of(path);
            if relative.to_lowercase().contains(&needle) {
                found.push(relative);
            }
            found.len() < MAXIMUM_SEARCH_RESULTS
        });
        found.sort();
        found
    }

    /// Lines of text files that contain the text, for "search in the project".
    pub fn find_text(&self, query: &str) -> Vec<TextMatch> {
        let needle = query.to_lowercase();
        let mut matches = Vec::new();
        if needle.is_empty() {
            return matches;
        }
        Self::walk(&self.root, &mut |path| {
            let too_large = fs::metadata(path).is_ok_and(|meta| meta.len() > MAXIMUM_FILE_BYTES);
            if let (false, Ok(text)) = (too_large, fs::read_to_string(path)) {
                for (index, line) in text.lines().enumerate() {
                    if line.to_lowercase().contains(&needle) {
                        matches.push(TextMatch {
                            relative_path: self.relative_of(path),
                            line: index + 1,
                            text: line.trim().chars().take(200).collect(),
                        });
                    }
                }
            }
            matches.len() < MAXIMUM_SEARCH_RESULTS
        });
        matches.truncate(MAXIMUM_SEARCH_RESULTS);
        matches
    }

    /// Turns a path the window sent into one inside the root: no `..`, no absolute paths, and
    /// nothing a link inside the folder points out of.
    fn resolve(&self, relative: &str) -> BrnchResult<PathBuf> {
        let requested = Path::new(relative);
        let escapes = requested.is_absolute()
            || requested.components().any(|part| {
                matches!(
                    part,
                    Component::ParentDir | Component::Prefix(_) | Component::RootDir
                )
            });
        if escapes {
            return Err(BrnchError::AgentProcess(format!(
                "{relative:?} is outside the workspace"
            )));
        }
        let root = self.root.canonicalize().map_err(Self::failure)?;
        let joined = root.join(requested);
        let existing = joined.canonicalize().map_err(Self::failure)?;
        if existing.starts_with(&root) {
            Ok(existing)
        } else {
            Err(BrnchError::AgentProcess(format!(
                "{relative:?} is outside the workspace"
            )))
        }
    }

    /// Visits every file under `folder` until the visitor says to stop.
    fn walk(folder: &Path, visit: &mut dyn FnMut(&Path) -> bool) -> bool {
        let Ok(entries) = fs::read_dir(folder) else {
            return true;
        };
        let mut paths: Vec<PathBuf> = entries.flatten().map(|entry| entry.path()).collect();
        paths.sort();
        for path in paths {
            let name = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned());
            if path.is_dir() {
                if name.is_some_and(|name| SKIPPED_FOLDERS.contains(&name.as_str())) {
                    continue;
                }
                if !Self::walk(&path, visit) {
                    return false;
                }
            } else if !visit(&path) {
                return false;
            }
        }
        true
    }

    fn relative_of(&self, path: &Path) -> String {
        path.strip_prefix(&self.root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/")
    }

    fn join(folder: &str, name: &str) -> String {
        if folder.is_empty() {
            name.to_owned()
        } else {
            format!("{}/{name}", folder.trim_end_matches('/'))
        }
    }

    // Taken by value so it can be passed straight to `map_err`.
    #[allow(clippy::needless_pass_by_value)]
    fn failure(error: std::io::Error) -> BrnchError {
        BrnchError::AgentProcess(error.to_string())
    }
}
