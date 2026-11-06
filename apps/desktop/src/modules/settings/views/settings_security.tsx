import { ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react'
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
        <h2 className="mb-2.5 text-sm font-semibold">{t('security.bySystem')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {(['windows', 'linux', 'macos'] as const).map(system => (
            <div key={system} className="rounded-xl border border-line bg-card px-4 py-3.5">
              <p className="text-[11px] text-muted">{t(`security.systems.${system}.name`)}</p>
              <p className="mt-1 font-medium">{t(`security.systems.${system}.mechanism`)}</p>
              <Badge variant={system === 'macos' ? 'warning' : 'success'} className="mt-2">{t(`security.systems.${system}.state`)}</Badge>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-muted">{t('security.agentKey')}</p>
    </SettingsLayout>
  )
}
