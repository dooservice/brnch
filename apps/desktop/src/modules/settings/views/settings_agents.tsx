import { BotIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { useDefaultPermission } from '@/lib/preferences'
import type { DefaultPermission } from '@/lib/preferences'
import { useAgentInstallations } from '@/modules/settings/api/use_system_status'
import SettingsLayout from '@/modules/settings/components/settings_layout'

export default function SettingsAgents() {
  const { t } = useTranslation('settings')
  const { data: installations = [], isPending, refetch, isFetching } = useAgentInstallations()
  const [defaultPermission, setDefaultPermission] = useDefaultPermission()
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
          <Badge>{t('agents.default')}</Badge>
        </div>
        {(['Codex', 'Gemini CLI', 'OpenCode'] as const).map(name => (
          <div key={name} className={row}>
            <BotIcon size={18} className="text-muted" />
            <div className="flex-1"><p className="font-medium">{name}</p><p className="text-[12px] text-muted">{t('agents.pendingVerification')}</p></div>
            <Badge>{t('agents.soon')}</Badge>
          </div>
        ))}
      </div>
      <div>
        <h2 className="mb-2.5 text-sm font-semibold">{t('agents.defaults')}</h2>
        <div className="rounded-xl border border-line bg-card">
          <div className={row}>
            <div className="flex-1"><p className="font-medium">{t('agents.defaultAgent')}</p><p className="text-[12px] text-muted">{t('agents.defaultAgentHint')}</p></div>
            <select aria-label={t('agents.defaultAgent')} value="claude_code" onChange={() => undefined} className="h-8 min-w-48 rounded-md border border-line bg-canvas px-2.5 outline-none"><option value="claude_code">Claude Code</option></select>
          </div>
          <div className={row}>
            <div className="flex-1"><p className="font-medium">{t('agents.defaultPermission')}</p><p className="text-[12px] text-muted">{t('agents.defaultPermissionHint')}</p></div>
            <select aria-label={t('agents.defaultPermission')} value={defaultPermission} onChange={event => setDefaultPermission(event.target.value as DefaultPermission)} className="h-8 min-w-48 rounded-md border border-line bg-canvas px-2.5 outline-none">
              <option value="edit_files">{t('agents.permissions.edit_files')}</option>
              <option value="plan_only">{t('agents.permissions.plan_only')}</option>
            </select>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-muted">{t('agents.ownKey')}</p>
    </SettingsLayout>
  )
}
