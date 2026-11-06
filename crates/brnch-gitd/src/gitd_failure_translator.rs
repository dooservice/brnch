use brnch_core::BrnchError;

/// Turns what gitd reports into the core's single error type.
pub struct GitdFailureTranslator;

impl GitdFailureTranslator {
    pub fn translate(failure: &gitd::Error) -> BrnchError {
        match failure.reason() {
            Some(reason) => {
                BrnchError::WorkspaceProvider(format!("{} ({})", failure, reason.as_str_name()))
            }
            None => BrnchError::WorkspaceProvider(failure.to_string()),
        }
    }
}
