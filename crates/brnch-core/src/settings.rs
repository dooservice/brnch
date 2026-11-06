/// The single home of the core's tunable values.
#[derive(Debug, Clone)]
pub struct BrnchSettings {
    pub branch_prefix: &'static str,
    pub maximum_diff_bytes: i64,
}

impl Default for BrnchSettings {
    fn default() -> Self {
        Self {
            branch_prefix: "agents/",
            maximum_diff_bytes: 1024 * 1024,
        }
    }
}
