import { TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { failureText } from '@/lib/tauri'
import { useAddGitToken, useGitCredentials, useRemoveGitCredential } from '../api/use_git_credentials'

const DEFAULT_PREFIX = 'https://github.com/'

/** Hands a token to gitd and lists what gitd keeps. brnch never stores the secret. */
export default function GitCredentialsForm() {
  const { t } = useTranslation('settings')
  const credentials = useGitCredentials(true)
  const add = useAddGitToken()
  const remove = useRemoveGitCredential()
  const [urlPrefix, setUrlPrefix] = useState(DEFAULT_PREFIX)
  const [token, setToken] = useState('')

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ul className="overflow-hidden rounded-lg border border-line" aria-label={t('credentials.saved')}>
        {(credentials.data ?? []).map(credential => (
          <li key={credential.identifier} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <span className="flex-1 font-mono text-[12.5px]">{credential.urlPrefix}</span>
            <Badge>{t(`credentials.kind.${credential.kind}`)}</Badge>
            <Button variant="ghost" aria-label={t('credentials.forget', { prefix: credential.urlPrefix })} icon={<TrashIcon size={13} />} onClick={() => remove.mutate(credential.identifier)} />
          </li>
        ))}
        {credentials.data?.length === 0 && <li className="px-4 py-2.5 text-muted">{t('credentials.none')}</li>}
      </ul>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={event => {
          event.preventDefault()
          add.mutate({ urlPrefix, token }, { onSuccess: () => setToken('') })
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">{t('credentials.prefix')}</span>
          <input value={urlPrefix} onChange={event => setUrlPrefix(event.target.value)} className="field font-mono text-[12.5px]" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">{t('credentials.token')}</span>
          <input type="password" value={token} onChange={event => setToken(event.target.value)} className="field font-mono text-[12.5px]" autoComplete="off" placeholder="github_pat_…" />
        </label>
        <p className="text-[12px] text-muted">{t('credentials.tokenHint')}</p>
        <div className="flex items-center justify-end gap-3">
          {add.isError && <span role="alert" className="text-[12.5px] text-danger">{failureText(add.error)}</span>}
          {add.isSuccess && <span className="text-[12.5px] text-ok">{t('credentials.savedOk')}</span>}
          <Button type="submit" loading={add.isPending} disabled={token.trim() === '' || urlPrefix.trim() === ''}>{t('credentials.save')}</Button>
        </div>
      </form>
      <p className="text-[12px] leading-relaxed text-muted">{t('credentials.sshNote')}</p>
    </div>
  )
}
