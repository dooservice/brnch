use brnch_desktop::SshKeyStore;

#[test]
fn a_key_is_made_once_and_the_same_one_comes_back() {
    let directory = std::env::temp_dir().join(format!("brnch-keys-{}", std::process::id()));
    let store = SshKeyStore::new(&directory);

    let first = store.ensure("brnch · test").unwrap();
    let again = store.ensure("brnch · test").unwrap();

    assert!(first.public_key.starts_with("ssh-ed25519 "));
    assert!(first.public_key.ends_with("brnch · test"));
    assert!(first.fingerprint.starts_with("SHA256:"));
    assert_eq!(first, again);
    store.discard();
    assert!(!store.private_key_path().exists());
    let _ = std::fs::remove_dir_all(&directory);
}
