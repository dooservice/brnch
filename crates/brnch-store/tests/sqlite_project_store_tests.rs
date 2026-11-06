use brnch_core::BrnchError;
use brnch_core::project::{ProjectId, ProjectStore, ProjectView};
use brnch_store::SqliteProjectStore;

const REPOSITORY: &str = "https://github.com/dooservice/brnch";

fn store() -> SqliteProjectStore {
    SqliteProjectStore::open_in_memory().expect("the in-memory store opens")
}

#[test]
fn switching_projects_brings_the_activated_one_to_the_front() {
    let store = store();
    let first = store.add_project("first", REPOSITORY).unwrap();
    let second = store.add_project("second", REPOSITORY).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));

    store.activate_project(&first.identifier).unwrap();

    let names: Vec<String> = store
        .list_projects()
        .unwrap()
        .into_iter()
        .map(|project| project.name)
        .collect();
    assert_eq!(names, ["first", "second"]);
    assert_eq!(store.active_project().unwrap(), Some(first.identifier));
    assert_ne!(second.identifier.as_str(), "");
}

#[test]
fn each_project_keeps_its_own_view() {
    let store = store();
    let first = store.add_project("first", REPOSITORY).unwrap();
    let second = store.add_project("second", REPOSITORY).unwrap();
    let view = ProjectView {
        layout_version: 3,
        layout_json: r#"{"tabs":["src/main.rs"]}"#.to_owned(),
    };

    store.save_view(&first.identifier, &view).unwrap();

    assert_eq!(store.load_view(&first.identifier).unwrap(), Some(view));
    assert_eq!(store.load_view(&second.identifier).unwrap(), None);
}

#[test]
fn saving_a_view_twice_keeps_only_the_latest() {
    let store = store();
    let project = store.add_project("only", REPOSITORY).unwrap();
    let older = ProjectView {
        layout_version: 1,
        layout_json: "{}".to_owned(),
    };
    let newer = ProjectView {
        layout_version: 1,
        layout_json: r#"{"a":1}"#.to_owned(),
    };

    store.save_view(&project.identifier, &older).unwrap();
    store.save_view(&project.identifier, &newer).unwrap();

    assert_eq!(store.load_view(&project.identifier).unwrap(), Some(newer));
}

#[test]
fn removing_a_project_removes_its_workspaces_view_and_active_mark() {
    let store = store();
    let project = store.add_project("gone", REPOSITORY).unwrap();
    store
        .add_workspace(&project.identifier, "/work/a", "agents/a")
        .unwrap();
    store
        .save_view(
            &project.identifier,
            &ProjectView {
                layout_version: 1,
                layout_json: "{}".to_owned(),
            },
        )
        .unwrap();
    store.activate_project(&project.identifier).unwrap();

    store.remove_project(&project.identifier).unwrap();

    assert_eq!(store.list_projects().unwrap().len(), 0);
    assert_eq!(store.list_workspaces(&project.identifier).unwrap().len(), 0);
    assert_eq!(store.load_view(&project.identifier).unwrap(), None);
    assert_eq!(store.active_project().unwrap(), None);
}

#[test]
fn workspaces_are_listed_per_project_in_creation_order() {
    let store = store();
    let project = store.add_project("p", REPOSITORY).unwrap();
    let other = store.add_project("q", REPOSITORY).unwrap();
    store
        .add_workspace(&project.identifier, "/work/a", "agents/a")
        .unwrap();
    store
        .add_workspace(&project.identifier, "/work/b", "agents/b")
        .unwrap();
    store
        .add_workspace(&other.identifier, "/work/c", "agents/c")
        .unwrap();

    let branches: Vec<String> = store
        .list_workspaces(&project.identifier)
        .unwrap()
        .into_iter()
        .map(|workspace| workspace.branch_name)
        .collect();

    assert_eq!(branches, ["agents/a", "agents/b"]);
}

#[test]
fn working_with_an_unknown_project_is_an_error() {
    let store = store();
    let missing = ProjectId::new("missing");

    assert!(matches!(
        store.add_workspace(&missing, "/work", "agents/x"),
        Err(BrnchError::UnknownProject(_))
    ));
    assert!(matches!(
        store.activate_project(&missing),
        Err(BrnchError::UnknownProject(_))
    ));
}

#[test]
fn data_survives_closing_and_reopening_the_file() {
    let directory = std::env::temp_dir().join(format!("brnch-store-{}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    let path = directory.join("brnch.sqlite3");
    let created = {
        let store = SqliteProjectStore::open(&path).unwrap();
        store.add_project("durable", REPOSITORY).unwrap()
    };

    let reopened = SqliteProjectStore::open(&path).unwrap();

    assert_eq!(reopened.list_projects().unwrap(), vec![created]);
    std::fs::remove_dir_all(&directory).unwrap();
}

mod event_history {
    use brnch_core::project::{EventHistoryStore, ProjectStore, StoredEvent};
    use brnch_store::SqliteProjectStore;

    fn store_with_workspace() -> (SqliteProjectStore, brnch_core::project::WorkspaceRecord) {
        let store = SqliteProjectStore::open_in_memory().unwrap();
        let project = store.add_project("p", "https://example.com/p").unwrap();
        let workspace = store
            .add_workspace(&project.identifier, "/work/a", "agents/a")
            .unwrap();
        (store, workspace)
    }

    #[test]
    fn events_get_consecutive_positions_and_can_be_read_after_one() {
        let (store, workspace) = store_with_workspace();

        assert_eq!(
            store
                .append_event(&workspace.identifier, "{\"a\":1}")
                .unwrap(),
            1
        );
        assert_eq!(
            store
                .append_event(&workspace.identifier, "{\"a\":2}")
                .unwrap(),
            2
        );

        assert_eq!(
            store.list_events(&workspace.identifier, 1).unwrap(),
            vec![StoredEvent {
                sequence: 2,
                event_json: "{\"a\":2}".to_owned()
            }]
        );
    }

    #[test]
    fn positions_start_again_for_each_workspace() {
        let (store, first) = store_with_workspace();
        let second = store
            .add_workspace(&first.project_identifier, "/work/b", "agents/b")
            .unwrap();
        store.append_event(&first.identifier, "{}").unwrap();

        assert_eq!(store.append_event(&second.identifier, "{}").unwrap(), 1);
    }

    #[test]
    fn removing_a_workspace_removes_its_history() {
        let (store, workspace) = store_with_workspace();
        store.append_event(&workspace.identifier, "{}").unwrap();

        store.remove_workspace(&workspace.identifier).unwrap();

        assert_eq!(
            store.list_events(&workspace.identifier, 0).unwrap().len(),
            0
        );
    }
}

#[test]
fn a_workspace_can_be_found_by_its_identifier() {
    let store = store();
    let project = store.add_project("p", REPOSITORY).unwrap();
    let created = store
        .add_workspace(&project.identifier, "/work/a", "agents/a")
        .unwrap();

    assert_eq!(
        store.find_workspace(&created.identifier).unwrap(),
        Some(created)
    );
    assert_eq!(
        store
            .find_workspace(&brnch_core::project::WorkspaceId::new("nope"))
            .unwrap(),
        None
    );
}

mod run_records {
    use brnch_core::project::{
        EventHistoryStore, ProjectStore, RunRecordStore, WorkspaceRunDetails,
    };
    use brnch_store::SqliteProjectStore;

    fn details(title: &str) -> WorkspaceRunDetails {
        WorkspaceRunDetails {
            run_identifier: "run-1".to_owned(),
            agent_kind: "claude_code".to_owned(),
            title: title.to_owned(),
            prompt: "do the thing".to_owned(),
            started_at_milliseconds: 1_000,
        }
    }

    #[test]
    fn a_workspace_remembers_its_task_and_the_newest_event() {
        let store = SqliteProjectStore::open_in_memory().unwrap();
        let project = store.add_project("p", "https://example.com/p").unwrap();
        let workspace = store
            .add_workspace(&project.identifier, "/w", "agents/a")
            .unwrap();

        store
            .record_run(&workspace.identifier, &details("First"))
            .unwrap();
        store
            .append_event(&workspace.identifier, "{\"n\":1}")
            .unwrap();
        store
            .append_event(&workspace.identifier, "{\"n\":2}")
            .unwrap();

        assert_eq!(
            store.find_run(&workspace.identifier).unwrap(),
            Some(details("First"))
        );
        assert_eq!(
            store
                .last_event(&workspace.identifier)
                .unwrap()
                .unwrap()
                .sequence,
            2
        );
        assert_eq!(
            store.workspaces_with_runs().unwrap(),
            vec![workspace.identifier]
        );
    }

    #[test]
    fn recording_again_replaces_the_task_and_a_workspace_without_events_has_no_last_event() {
        let store = SqliteProjectStore::open_in_memory().unwrap();
        let project = store.add_project("p", "https://example.com/p").unwrap();
        let workspace = store
            .add_workspace(&project.identifier, "/w", "agents/a")
            .unwrap();
        store
            .record_run(&workspace.identifier, &details("First"))
            .unwrap();

        store
            .record_run(&workspace.identifier, &details("Second"))
            .unwrap();

        assert_eq!(
            store
                .find_run(&workspace.identifier)
                .unwrap()
                .unwrap()
                .title,
            "Second"
        );
        assert_eq!(store.last_event(&workspace.identifier).unwrap(), None);
    }
}
