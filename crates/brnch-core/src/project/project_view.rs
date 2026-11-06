/// What a person had open in a project: tabs, panes, terminals. The core does not read the
/// layout, it only stores it, so the interface can change it without a core release.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectView {
    pub layout_version: u32,
    pub layout_json: String,
}
