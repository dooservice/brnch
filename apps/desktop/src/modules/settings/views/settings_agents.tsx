import { BotIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { useAgentInstallations } from '@/modules/settings/api/use_system_status'
import SettingsLayout from '@/modules/settings/components/settings_layout'

export default function SettingsAgents() {
  const { t } = useTranslation('settings')
  const { data: installations = [], isPending, refetch, isFetching } = useAgentInstallations()
  const claude = installations.find(installation => installation.kind === 'claude_code')
  const row = 'flex items-center gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0'

  return (
    <SettingsLayout title={t('agents.title')} description={t('agents.description')}>
      <div className="flex justify-end">
        <Button variant="outline" loading={isFetching} onClick={() => void refetch()}>{t('agents.detectAgain')}</Button>
      </div>
      <div className="rounded-xl border border-line bg-card">
        <div className={row}>
          <BotIcon size={18} className="text-muted" />
          <div className="flex-1"><p className="font-medium">Claude Code</p><p className="font-mono text-[12px] text-muted">{claude?.version ?? 'claude'}</p></div>
          {isPending ? <Badge>{t('agents.checking')}</Badge> : claude?.installed ? <Badge variant="success">{t('agents.installed')}</Badge> : <Badge variant="danger">{t('agents.notInstalled')}</Badge>}
        </div>
        {(['Codex', 'Gemini CLI', 'OpenCode'] as const).map(name => (
          <div key={name} className={row}>
            <BotIcon size={18} className="text-muted" />
            <div className="flex-1"><p className="font-medium">{name}</p><p className="text-[12px] text-muted">{t('agents.pendingVerification')}</p></div>
            <Badge>{t('agents.soon')}</Badge>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-muted">{t('agents.ownKey')}</p>
    </SettingsLayout>
  )
}
