/// Decides whether the agent may do what it asks, given what it says it wants to do.
pub trait PermissionPolicy: Send + Sync {
    fn allows(&self, action_title: &str) -> bool;
}

/// For runs the person already approved as a whole: the agent works in its own workspace, which
/// is confined, so each step is allowed.
#[derive(Debug, Default, Clone, Copy)]
pub struct AllowEverything;

impl PermissionPolicy for AllowEverything {
    fn allows(&self, _: &str) -> bool {
        true
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct DenyEverything;

impl PermissionPolicy for DenyEverything {
    fn allows(&self, _: &str) -> bool {
        false
    }
}
