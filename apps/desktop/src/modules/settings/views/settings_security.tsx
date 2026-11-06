import { FolderIcon, LockIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import { useSandboxStatus } from '@/modules/settings/api/use_system_status'
import SettingsLayout from '@/modules/settings/components/settings_layout'

export default function SettingsSecurity() {
  const { t } = useTranslation('settings')
  const { data: sandbox } = useSandboxStatus()
  const active = sandbox?.available === true
  const checking = sandbox === undefined

  return (
    <SettingsLayout title={t('security.title')} description={t('security.description')}>
      <div className={`flex items-center gap-3.5 rounded-xl border px-4 py-4 ${checking ? 'border-line bg-card' : active ? 'border-[#1d4a33] bg-[#0e1c15]' : 'border-[#4a3a14] bg-[#1a150a]'}`}>
        {active ? <ShieldCheckIcon size={22} className="text-ok" /> : <ShieldAlertIcon size={22} className={checking ? 'text-muted' : 'text-warn'} />}
        <div className="flex-1">
          <p className={`font-semibold ${checking ? 'text-muted' : active ? 'text-[#8be0b2]' : 'text-warn'}`}>{checking ? t('security.checking') : active ? t('security.active', { mechanism: sandbox.mechanism }) : t('security.inactive')}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{checking ? '' : active ? t('security.activeHint') : (sandbox.reason ?? t('security.unknown'))}</p>
        </div>
      </div>
      <div>
        <h2 className="mb-2.5 text-sm font-semibold">{t('security.whatAgentSees')}</h2>
        <div className="rounded-xl border border-line bg-card">
          {(['ssh', 'gh', 'credentials', 'agent'] as const).map(item => (
            <div key={item} className="flex items-center gap-3 border-b border-line px-4 py-3">
              <LockIcon size={14} className={active ? 'text-ok' : 'text-warn'} />
              <span className="flex-1">{t(`security.items.${item}`)}</span>
              <Badge variant={checking ? 'muted' : active ? 'success' : 'warning'}>{checking ? t('security.checking') : active ? t('security.hidden') : t('security.visible')}</Badge>
            </div>
          ))}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <LockIcon size={14} className="text-ok" />
            <span className="flex-1">{t('security.items.variables')}</span>
            <Badge variant="success">{t('security.removed')}</Badge>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <FolderIcon size={14} className="text-info" />
            <span className="flex-1">{t('security.items.workspace')}</span>
            <Badge variant="info">{t('security.allowed')}</Badge>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted">{t('security.byConstruction')}</p>
      </div>
      <div>
        <h2 className="mb-2.5 text-sm font-semibold">{t('security.options')}</h2>
        <div className="flex items-center gap-4 rounded-xl border border-line bg-card px-4 py-3.5">
          <div className="flex-1"><p className="font-medium">{t('security.neverUnconfined')}</p><p className="text-[12px] text-muted">{t('security.neverUnconfinedHint')}</p></div>
          <span aria-label={t('security.locked')} role="img" className="relative h-4.5 w-8 shrink-0 rounded-full bg-ok opacity-50"><span className="absolute top-0.5 left-4 size-3.5 rounded-full bg-ink" /></span>
        </div>
      </div>
      <div>
        <h2 className="mb-2.5 text-sm font-semibold">{t('security.bySystem')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {(['windows', 'linux', 'macos'] as const).map(system => (
            <div key={system} className="rounded-xl border border-line bg-card px-4 py-3.5">
              <p className="text-[11px] text-muted">{t(`security.systems.${system}.name`)}</p>
              <p className="mt-1 font-medium">{t(`security.systems.${system}.mechanism`)}</p>
              <Badge variant={system === 'linux' ? 'success' : 'warning'} className="mt-2">{t(`security.systems.${system}.state`)}</Badge>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-muted">{t('security.agentKey')}</p>
    </SettingsLayout>
  )
}
