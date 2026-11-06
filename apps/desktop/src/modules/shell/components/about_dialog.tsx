import { GitBranchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/button'
import Dialog from '@/components/dialog'
import { useDialog } from '@/hooks/use_dialog'

/** What brnch is and which version this is. */
export default function AboutDialog() {
  const { t } = useTranslation('shell')
  const dialog = useDialog('about')
  return (
    <Dialog
      open={dialog.open}
      onOpenChange={open => (open ? dialog.show() : dialog.hide())}
      title={t('about.title')}
      description={t('about.version', { version: __APP_VERSION__ })}
      className="w-120"
      footer={<><span className="flex-1" /><Button onClick={dialog.hide}>{t('close', { ns: 'common' })}</Button></>}
    >
      <div className="flex items-start gap-3.5 px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-lg border border-line"><GitBranchIcon size={20} /></span>
        <p className="flex-1 leading-relaxed text-[#c4c4cc]">{t('about.body')}</p>
      </div>
    </Dialog>
  )
}
