/// Identifies a project for its whole life. It is opaque on purpose: a folder can move or
/// be renamed without losing the project's history.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ProjectId(String);

impl ProjectId {
    pub fn new(value: &str) -> Self {
        Self(value.to_owned())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}
