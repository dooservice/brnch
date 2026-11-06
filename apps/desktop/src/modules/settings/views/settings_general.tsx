import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/lib/i18n'
import SettingsLayout from '@/modules/settings/components/settings_layout'

export default function SettingsGeneral() {
  const { t, i18n } = useTranslation('settings')
  const current = i18n.resolvedLanguage ?? 'en'
  return (
    <SettingsLayout title={t('general.title')} description={t('general.description')}>
      <div className="rounded-xl border border-line bg-card">
        <div className="flex items-center gap-5 px-4 py-3.5">
          <div className="flex-1">
            <p className="font-medium">{t('general.language')}</p>
            <p className="text-[12px] text-muted">{t('general.languageHint')}</p>
          </div>
          <select
            aria-label={t('general.language')}
            value={current}
            onChange={event => void i18n.changeLanguage(event.target.value)}
            className="h-8 min-w-44 rounded-md border border-line bg-canvas px-2.5 outline-none"
          >
            {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </div>
      </div>
    </SettingsLayout>
  )
}
