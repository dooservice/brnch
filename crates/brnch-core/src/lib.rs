//! brnch core: everything that does not depend on a user interface or on gitd.
//!
//! The desktop shell and the gitd adapter only talk to the types exported here, so the same
//! rules run on every platform and against any workspace provider.

pub mod agent;
pub mod error;
pub mod project;
pub mod settings;
pub mod workspace;

pub use error::{BrnchError, BrnchResult};
pub use settings::BrnchSettings;
