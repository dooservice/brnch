use std::path::{Path, PathBuf};

use brnch_core::{BrnchError, BrnchResult};
use ssh_key::rand_core::OsRng;
use ssh_key::{Algorithm, HashAlg, LineEnding, PrivateKey};

const KEYS_DIRECTORY: &str = "keys";
const PRIVATE_KEY_FILE: &str = "id_ed25519";

/// The SSH key brnch makes for this computer: the private half stays in the person's own data
/// folder, and only the public half is ever shown.
pub struct SshKeyStore {
    directory: PathBuf,
}

/// What the person copies to GitHub, and the fingerprint to recognise it by.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SshKeyInfo {
    pub public_key: String,
    pub fingerprint: String,
}

impl SshKeyStore {
    pub fn new(directory: &Path) -> Self {
        Self {
            directory: directory.join(KEYS_DIRECTORY),
        }
    }

    pub fn private_key_path(&self) -> PathBuf {
        self.directory.join(PRIVATE_KEY_FILE)
    }

    /// The key of this computer, made the first time it is asked for.
    pub fn ensure(&self, comment: &str) -> BrnchResult<SshKeyInfo> {
        let path = self.private_key_path();
        let key = if path.is_file() {
            Self::read(&path)?
        } else {
            self.create(&path, comment)?
        };
        Self::describe(&key)
    }

    /// Forgets the key; GitHub keeps listing it until the person removes it there.
    pub fn discard(&self) {
        let _ = std::fs::remove_dir_all(&self.directory);
    }

    fn create(&self, path: &Path, comment: &str) -> BrnchResult<PrivateKey> {
        let failure = |reason: String| {
            BrnchError::AgentProcess(format!("the SSH key could not be made: {reason}"))
        };
        let mut key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519)
            .map_err(|error| failure(error.to_string()))?;
        key.set_comment(comment);
        let text = key
            .to_openssh(LineEnding::LF)
            .map_err(|error| failure(error.to_string()))?;
        std::fs::create_dir_all(&self.directory).map_err(|error| failure(error.to_string()))?;
        std::fs::write(path, text.as_bytes()).map_err(|error| failure(error.to_string()))?;
        Self::keep_private(path);
        Ok(key)
    }

    #[cfg(unix)]
    fn keep_private(path: &Path) {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }

    /// Windows already keeps a user's profile to that user, SYSTEM and administrators.
    #[cfg(not(unix))]
    fn keep_private(_path: &Path) {}

    fn read(path: &Path) -> BrnchResult<PrivateKey> {
        let text = std::fs::read_to_string(path).map_err(|error| {
            BrnchError::AgentProcess(format!("the SSH key cannot be read: {error}"))
        })?;
        PrivateKey::from_openssh(text)
            .map_err(|error| BrnchError::AgentProcess(format!("the SSH key is damaged: {error}")))
    }

    fn describe(key: &PrivateKey) -> BrnchResult<SshKeyInfo> {
        let public_key = key
            .public_key()
            .to_openssh()
            .map_err(|error| BrnchError::AgentProcess(error.to_string()))?;
        Ok(SshKeyInfo {
            public_key,
            fingerprint: key.fingerprint(HashAlg::Sha256).to_string(),
        })
    }
}
