use brnch_desktop::ProjectService;
use brnch_store::SqliteProjectStore;

fn service() -> ProjectService<SqliteProjectStore> {
    ProjectService::new(std::sync::Arc::new(
        SqliteProjectStore::open_in_memory().unwrap(),
    ))
}

#[test]
fn the_interface_sees_projects_with_the_names_it_expects() {
    let service = service();
    let created = service
        .add_project("web", "https://example.com/acme/web")
        .unwrap();

    let json = serde_json::to_string(&created).unwrap();

    assert!(json.contains(r#""repositoryUrl":"https://example.com/acme/web""#));
    assert_eq!(service.list_projects().unwrap(), vec![created]);
}

#[test]
fn a_saved_layout_comes_back_for_that_project_only() {
    let service = service();
    let first = service.add_project("a", "https://example.com/a").unwrap();
    let second = service.add_project("b", "https://example.com/b").unwrap();

    service
        .save_view(&first.identifier, r#"{"tabs":[1]}"#)
        .unwrap();

    assert_eq!(
        service.load_view(&first.identifier).unwrap().as_deref(),
        Some(r#"{"tabs":[1]}"#)
    );
    assert_eq!(service.load_view(&second.identifier).unwrap(), None);
}

#[test]
fn activating_a_project_makes_it_the_active_one() {
    let service = service();
    let project = service.add_project("a", "https://example.com/a").unwrap();

    service.activate_project(&project.identifier).unwrap();

    assert_eq!(
        service.active_project_identifier().unwrap(),
        Some(project.identifier)
    );
}
