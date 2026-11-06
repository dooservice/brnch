import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import languages from '@locales/languages.json'
import { STORAGE_PREFIX } from '@/lib/constants'

/** Every language the app offers, each namespace a file under `locales/<code>/`. */
const files = import.meta.glob<Record<string, unknown>>('../../locales/*/*.json', { eager: true, import: 'default' })

const resources: Record<string, Record<string, Record<string, unknown>>> = {}
for (const [path, texts] of Object.entries(files)) {
  const [language, file] = path.split('/').slice(-2)
  if (file === undefined || language === 'languages.json') continue
  resources[language] ??= {}
  resources[language][file.replace('.json', '')] = texts
}

export const LANGUAGES = languages
export const LANGUAGE_CODES = languages.map(language => language.code)
const STORAGE_KEY = `${STORAGE_PREFIX}language`

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'common',
    fallbackLng: 'en',
    supportedLngs: LANGUAGE_CODES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

export default i18next
