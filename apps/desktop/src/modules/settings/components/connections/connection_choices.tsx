import { CheckIcon, KeyRoundIcon, LockIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import GithubMark from '@/components/github_mark'
import { cn } from '@/lib/utils'

export type ConnectionMethod = 'github' | 'ssh' | 'token'

const METHODS = [
  { key: 'github', icon: GithubMark, recommended: true },
  { key: 'ssh', icon: KeyRoundIcon, recommended: false },
  { key: 'token', icon: LockIcon, recommended: false },
] as const

/** The three ways gitd can be given access to GitHub, side by side. */
export default function ConnectionChoices({ onChoose }: { onChoose: (method: ConnectionMethod) => void }) {
  const { t } = useTranslation('settings')
  return (
    <ul className="grid grid-cols-3 gap-3.5" aria-label={t('connections.choose.label')}>
      {METHODS.map(({ key, icon: Icon, recommended }) => (
        <li key={key} className={cn('flex flex-col gap-3 rounded-[10px] border p-4.5', recommended ? 'border-[#3a3a42] bg-[#16161b]' : 'border-line')}>
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-[10px] border border-line bg-canvas"><Icon size={22} /></span>
            {recommended ? <Badge variant="success">{t('connections.choose.recommended')}</Badge> : <span className="h-5" />}
          </div>
          <p className="text-[15px] font-semibold">{t(`connections.choose.${key}.title`)}</p>
          <p className="text-[12.5px] leading-relaxed text-muted">{t(`connections.choose.${key}.description`)}</p>
          <ul className="flex flex-1 flex-col gap-1.5 text-[12.5px]">
            {(['one', 'two', 'three'] as const).map(point => (
              <li key={point} className="flex items-start gap-2 leading-snug"><CheckIcon size={14} className="mt-0.5 shrink-0 text-ok" /><span>{t(`connections.choose.${key}.${point}`)}</span></li>
            ))}
          </ul>
          <Button variant={recommended ? 'default' : 'outline'} className="justify-center" onClick={() => onChoose(key)}>{t(`connections.choose.${key}.action`)}</Button>
        </li>
      ))}
    </ul>
  )
}
