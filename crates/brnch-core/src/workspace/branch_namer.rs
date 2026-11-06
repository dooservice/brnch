use crate::error::{BrnchError, BrnchResult};
use crate::settings::BrnchSettings;

/// Turns the label a person gave a run into the name of the branch its work is published on.
pub struct BranchNamer<'settings> {
    settings: &'settings BrnchSettings,
}

impl<'settings> BranchNamer<'settings> {
    pub fn new(settings: &'settings BrnchSettings) -> Self {
        Self { settings }
    }

    pub fn name_for(&self, run_label: &str) -> BrnchResult<String> {
        if run_label.trim().is_empty() {
            return Err(BrnchError::EmptyRunLabel);
        }
        let slug = Self::slugify(run_label);
        if slug.is_empty() {
            return Err(BrnchError::UnnameableRunLabel(run_label.to_owned()));
        }
        Ok(format!("{}{slug}", self.settings.branch_prefix))
    }

    fn slugify(run_label: &str) -> String {
        let mut slug = String::new();
        let mut separator_pending = false;
        for character in run_label.chars() {
            if character.is_alphanumeric() {
                if separator_pending && !slug.is_empty() {
                    slug.push('-');
                }
                separator_pending = false;
                slug.extend(character.to_lowercase());
            } else {
                separator_pending = true;
            }
        }
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn name_for(run_label: &str) -> BrnchResult<String> {
        let settings = BrnchSettings::default();
        BranchNamer::new(&settings).name_for(run_label)
    }

    #[test]
    fn joins_words_with_single_hyphens_under_the_prefix() {
        assert_eq!(
            name_for("  Fix   login, bug! ").unwrap(),
            "agents/fix-login-bug"
        );
    }

    #[test]
    fn keeps_accented_letters() {
        assert_eq!(name_for("Sesión nueva").unwrap(), "agents/sesión-nueva");
    }

    #[test]
    fn refuses_a_blank_label() {
        assert!(matches!(name_for("   "), Err(BrnchError::EmptyRunLabel)));
    }

    #[test]
    fn refuses_a_label_without_letters_or_digits() {
        assert!(matches!(
            name_for("?!-"),
            Err(BrnchError::UnnameableRunLabel(_))
        ));
    }
}
