import { ArrowUpIcon, BotIcon, PencilIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { failureText } from '@/lib/tauri'
import Badge from '@/components/badge'
import { useSandboxStatus } from '@/modules/settings'
import { useSendFollowUp } from '../api/use_workspaces'
import type { Workspace } from '../types/workspace.types'

/** The box under the conversation: a new message to the agent of this workspace. */
export default function Composer({ workspace }: { workspace: Workspace }) {
  const { t } = useTranslation('workspaces')
  const [text, setText] = useState('')
  const send = useSendFollowUp()
  const { data: sandbox } = useSandboxStatus()
  const working = workspace.status === 'running'
  const noRun = workspace.runIdentifier === null

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (text.trim() === '' || working || noRun) return
    await send.mutateAsync({ workspaceIdentifier: workspace.identifier, prompt: text.trim() })
    setText('')
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit()
  }

  return (
    <form onSubmit={submit} className="px-6 pb-4">
      <div className="mx-auto w-full max-w-175 rounded-xl border border-line bg-card px-3.5 py-3">
        <textarea
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={working || noRun}
          rows={2}
          aria-label={t('composer.label')}
          placeholder={working ? t('composer.working') : noRun ? t('composer.noRun') : t('composer.placeholder')}
          className="w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-muted disabled:opacity-60"
        />
        {send.isError && <p role="alert" className="mb-2 text-[12.5px] text-danger">{failureText(send.error)}</p>}
        <div className="flex items-center gap-2">
          <Badge><BotIcon size={12} />{workspace.agentLabel || '—'}</Badge>
          {workspace.permissionMode !== null && <Badge><PencilIcon size={12} />{t(`composer.modes.${workspace.permissionMode}`)}</Badge>}
          {sandbox?.available ? (
            <Badge variant="success"><ShieldCheckIcon size={12} />{t('composer.confined')}</Badge>
          ) : (
            <Badge variant="warning"><ShieldAlertIcon size={12} />{t('composer.notConfined')}</Badge>
          )}
          <span className="flex-1" />
          <span className="font-mono text-[10.5px] text-muted">Ctrl ↵</span>
          <button type="submit" aria-label={t('composer.send')} disabled={send.isPending || working || noRun || text.trim() === ''} className="flex size-7 items-center justify-center rounded-md bg-ink text-canvas disabled:opacity-40">
            <ArrowUpIcon size={14} />
          </button>
        </div>
      </div>
    </form>
  )
}
