import 'i18next'

import type common from '@locales/en/common.json'
import type editor from '@locales/en/editor.json'
import type onboarding from '@locales/en/onboarding.json'
import type projects from '@locales/en/projects.json'
import type review from '@locales/en/review.json'
import type runs from '@locales/en/runs.json'
import type settings from '@locales/en/settings.json'
import type shell from '@locales/en/shell.json'
import type terminal from '@locales/en/terminal.json'
import type workspaces from '@locales/en/workspaces.json'

/** Every `t('key')` is checked against the English catalog, which the other languages mirror. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: { common: typeof common; editor: typeof editor; onboarding: typeof onboarding; projects: typeof projects; review: typeof review; runs: typeof runs; settings: typeof settings; shell: typeof shell; terminal: typeof terminal; workspaces: typeof workspaces }
  }
}
