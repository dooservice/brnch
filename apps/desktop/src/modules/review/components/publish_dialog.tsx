import { BotIcon, CheckIcon, CircleCheckIcon, CircleIcon, CircleXIcon, GlobeIcon, Loader2Icon, LockIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/button'
import Dialog from '@/components/dialog'
import { useDialog } from '@/hooks/use_dialog'
import { failureText } from '@/lib/tauri'
import { useAllWorkspaces } from '@/modules/workspaces'
import { usePublish } from '../api/use_publish'

/** Publishing is gitd's job: it pushes with the token it holds, and the agent never had it. */
export default function PublishDialog() {
  const { t } = useTranslation('review')
  const dialog = useDialog('publish')
  const publish = usePublish()
  const all = useAllWorkspaces().flatMap(entry => entry.workspaces)
  const identifiers = (dialog.get('workspaces') ?? '').split(',').filter(identifier => identifier !== '')
  const chosen = identifiers.map(identifier => all.find(workspace => workspace.identifier === identifier)).filter(workspace => workspace !== undefined)
  const outcomes = publish.data

  const close = () => {
    publish.reset()
    dialog.hide()
  }

  return (
    <Dialog
      side
      open={dialog.open}
      onOpenChange={open => (open ? dialog.show() : close())}
      title={t('publish.title', { count: chosen.length })}
      description={t('publish.description')}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={close}>{outcomes ? t('close', { ns: 'common' }) : t('cancel', { ns: 'common' })}</Button>
          {!outcomes && <Button loading={publish.isPending} disabled={chosen.length === 0} onClick={() => publish.mutate(identifiers)}>{t('publish.action')}</Button>}
        </>
      }
    >
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex items-start justify-center gap-4 py-1" aria-hidden="true">
          {[{ icon: BotIcon, label: t('publish.flow.agent'), note: t('publish.flow.noToken'), tone: 'text-danger' }, { icon: LockIcon, label: 'gitd', note: t('publish.flow.holdsToken'), tone: 'text-muted' }, { icon: GlobeIcon, label: 'GitHub', note: t('publish.flow.remote'), tone: 'text-muted' }].map((node, index) => (
            <div key={node.label} className="contents">
              {index > 0 && <span className="mt-5 h-px flex-1 bg-[#3a3a42]" />}
              <div className="flex w-24 flex-col items-center gap-1.5 text-center">
                <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-canvas"><node.icon size={16} /></span>
                <span className="font-medium">{node.label}</span>
                <span className={`text-[11px] ${node.tone}`}>{node.note}</span>
              </div>
            </div>
          ))}
        </div>
        <ul aria-label={t('publish.order')} className="flex flex-col gap-2">
          {chosen.map(workspace => {
            const outcome = outcomes?.find(candidate => candidate.workspaceIdentifier === workspace.identifier)
            return (
              <li key={workspace.identifier} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
                {!outcome && (publish.isPending ? <Loader2Icon size={16} aria-label={t('publish.publishing')} className="mt-0.5 animate-spin text-warn" /> : <CircleIcon size={16} className="mt-0.5 text-muted" />)}
                {outcome?.failure === null && <CircleCheckIcon size={16} aria-label={t('publish.published')} className="mt-0.5 text-ok" />}
                {outcome && outcome.failure !== null && <CircleXIcon size={16} aria-label={t('publish.refused')} className="mt-0.5 text-danger" />}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px]">{workspace.branchName}</p>
                  {outcome?.failure && <p role="alert" className="mt-0.5 text-[12.5px] text-danger">{outcome.failure}</p>}
                  {outcome?.branchName && <p className="mt-0.5 text-[12px] text-muted">{t('publish.publishedAs', { name: outcome.branchName })}</p>}
                </div>
              </li>
            )
          })}
        </ul>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">{t('publish.checksTitle')}</h3>
          <ul className="flex flex-col gap-1.5">
            {(['prefix', 'protectedPaths', 'size'] as const).map(check => (
              <li key={check} className="flex items-center gap-2"><CheckIcon size={13} className="text-ok" />{t(`publish.checks.${check}`)}</li>
            ))}
          </ul>
        </div>
        {publish.isError && <p role="alert" className="text-[12.5px] text-danger">{failureText(publish.error)}</p>}
      </div>
    </Dialog>
  )
}
