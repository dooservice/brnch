import { CheckCircle2Icon, ClockIcon, CopyIcon, ExternalLinkIcon, Loader2Icon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { useNow } from '@/hooks/use_now'
import { failureText, openExternal } from '@/lib/tauri'
import { useBeginGithubLogin, useFinishGithubLogin, useRemoveGitCredential } from '../../api/use_git_credentials'
import type { GithubLoginPrompt } from '../../types/settings.types'

function remaining(prompt: GithubLoginPrompt, startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((startedAt + prompt.expiresInSeconds * 1000 - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Signs gitd in to GitHub with a code: the person picks the account on github.com, not here. */
export default function GithubSignIn({ onBack, onFinished }: { onBack: () => void; onFinished: () => void }) {
  const { t } = useTranslation('settings')
  const { mutate: beginLogin, data: prompt, isPending: starting, error: startError } = useBeginGithubLogin()
  const { mutate: finishLogin, data: result, error: finishError, reset: resetFinish } = useFinishGithubLogin()
  const remove = useRemoveGitCredential()
  const [startedAt, setStartedAt] = useState(0)
  const requested = useRef(false)
  const now = useNow(1000)

  const start = useCallback(() => {
    resetFinish()
    beginLogin(undefined, {
      onSuccess: next => {
        setStartedAt(Date.now())
        void navigator.clipboard?.writeText(next.userCode).catch(() => undefined)
        void openExternal(next.verificationUrl).catch(() => undefined)
        finishLogin(next.loginIdentifier)
      },
    })
  }, [beginLogin, finishLogin, resetFinish])

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    start()
  }, [start])

  const failure = startError ?? finishError
  if (result) {
    const account = result.credential.actsAs
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex gap-2.5 rounded-lg border border-[#1d4a33] bg-[#0a1a12] px-3.5 py-3 leading-relaxed text-[#bfe9d1]"><CheckCircle2Icon size={14} className="mt-1 shrink-0 text-ok" /><span>{t('connections.github.connected')}</span></div>
        <div className="flex items-center gap-3.5 rounded-[10px] border border-line px-4 py-3.5">
          <span className="flex size-11 items-center justify-center rounded-full border border-line bg-hover text-[16px] font-semibold" aria-hidden="true">{account.slice(0, 1).toUpperCase()}</span>
          <div className="flex-1"><p className="text-[15px] font-semibold">@{account}</p><p className="text-[12px] text-muted">{t('connections.github.account')}</p></div>
          <Badge variant="success">{t('connections.github.active')}</Badge>
          <Button variant="outline" className="h-7" onClick={start}>{t('connections.github.change')}</Button>
          <Button variant="ghost" className="h-7" onClick={() => remove.mutate(result.credential.identifier, { onSuccess: onBack })}>{t('connections.github.disconnect')}</Button>
        </div>
        <div className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1"><p className="font-semibold">{t('connections.github.reachTitle')}</p><p className="mt-0.5 text-[12px] text-muted">{t('connections.github.reachHint')}</p></div>
            {result.installUrl !== '' && <Button variant="outline" icon={<ExternalLinkIcon size={14} />} onClick={() => void openExternal(result.installUrl)}>{t('connections.github.choose')}</Button>}
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={onFinished}>{t('connections.done')}</Button></div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-start gap-3.5 rounded-[10px] border border-line bg-canvas p-5">
          <span className="text-[12px] text-muted">{t('connections.github.codeLabel')}</span>
          <p className="font-mono text-[40px] font-medium tracking-[0.08em]" aria-live="polite">{prompt?.userCode ?? '····-····'}</p>
          <div className="flex gap-2">
            <Button icon={<ExternalLinkIcon size={14} />} disabled={!prompt} onClick={() => prompt && void openExternal(prompt.verificationUrl)}>{t('connections.github.open')}</Button>
            <Button variant="outline" icon={<CopyIcon size={14} />} disabled={!prompt} onClick={() => prompt && void navigator.clipboard.writeText(prompt.userCode)}>{t('connections.github.copy')}</Button>
          </div>
          <p className="text-[12px] text-muted">{t('connections.github.opens', { address: 'github.com/login/device' })}</p>
        </div>
        <ol className="flex flex-col justify-center gap-3.5">
          {(['one', 'two', 'three'] as const).map((point, position) => (
            <li key={point} className="flex items-start gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-canvas">{position + 1}</span><div><p className="font-medium">{t(`connections.github.step.${point}.title`)}</p><p className="text-[12px] text-muted">{t(`connections.github.step.${point}.hint`)}</p></div></li>
          ))}
        </ol>
      </div>
      {failure ? (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-[#5a2326] px-3.5 py-3"><span className="flex-1 text-danger">{failureText(failure)}</span><Button variant="outline" onClick={start}>{t('connections.github.retry')}</Button></div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-3">
          <Loader2Icon size={16} className="animate-spin text-warn" />
          <span className="flex-1">{starting ? t('connections.github.starting') : t('connections.github.waiting')}</span>
          {prompt && <Badge><ClockIcon size={12} />{t('connections.github.expires', { time: remaining(prompt, startedAt, now) })}</Badge>}
        </div>
      )}
      <div className="flex"><Button variant="ghost" className="px-0" onClick={onBack}>{t('connections.cancel')}</Button></div>
    </div>
  )
}
