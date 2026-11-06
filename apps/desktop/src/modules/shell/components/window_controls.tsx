import { MinusIcon, SquareIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { insideTauri } from '@/lib/tauri'

/** Minimize, maximize and close, for the window without its own frame. */
export default function WindowControls() {
  const { t } = useTranslation('shell')
  if (!insideTauri()) return null
  const act = async (action: 'minimize' | 'toggleMaximize' | 'close') => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow()[action]()
  }
  const button = 'flex h-9 w-11.5 items-center justify-center text-muted hover:bg-hover hover:text-ink'
  return (
    <div className="flex">
      <button type="button" aria-label={t('window.minimize')} className={button} onClick={() => void act('minimize')}><MinusIcon size={14} /></button>
      <button type="button" aria-label={t('window.maximize')} className={button} onClick={() => void act('toggleMaximize')}><SquareIcon size={12} /></button>
      <button type="button" aria-label={t('window.close')} className={`${button} hover:bg-danger hover:text-white`} onClick={() => void act('close')}><XIcon size={14} /></button>
    </div>
  )
}
