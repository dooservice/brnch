import { ArrowLeftIcon, BotIcon, PlugIcon, ShieldIcon, SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { key: 'general', icon: SettingsIcon },
  { key: 'agents', icon: BotIcon },
  { key: 'security', icon: ShieldIcon },
  { key: 'connections', icon: PlugIcon },
] as const

/** The settings pages share a menu on the left and a column of content. */
export default function SettingsLayout({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const { t } = useTranslation('settings')
  return (
    <main className="flex min-w-0 flex-1">
      <nav aria-label={t('nav.label')} className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-line bg-side p-2.5">
        <NavLink to="/" className="mb-2 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-muted hover:text-ink"><ArrowLeftIcon size={14} />{t('nav.back')}</NavLink>
        {SECTIONS.map(({ key, icon: Icon }) => (
          <NavLink key={key} to={`/settings/${key}`} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-md px-2.5 py-1.5', isActive ? 'bg-hover text-ink' : 'text-[#c4c4cc] hover:bg-hover')}>
            <Icon size={14} />{t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-1 justify-center overflow-y-auto px-6 py-8">
        <div className="flex w-full max-w-205 flex-col gap-5">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-1 text-muted">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}
