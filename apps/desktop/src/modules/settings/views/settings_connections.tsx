import { useTranslation } from 'react-i18next'
import { useGitdStatus } from '@/modules/settings/api/use_system_status'
import PublishConnection from '@/modules/settings/components/connections/publish_connection'
import SettingsLayout from '@/modules/settings/components/settings_layout'

export default function SettingsConnections() {
  const { t } = useTranslation('settings')
  const gitd = useGitdStatus()
  return (
    <SettingsLayout title={t('connections.title')} description={t('connections.description')}>
      {gitd.data?.connected ? <PublishConnection /> : <p className="text-muted">{t('connections.needsGitd')}</p>}
    </SettingsLayout>
  )
}
