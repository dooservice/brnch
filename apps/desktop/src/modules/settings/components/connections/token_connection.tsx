import { CheckIcon, ClockIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/button'
import { failureText, openExternal } from '@/lib/tauri'
import { useAddGitToken } from '../../api/use_git_credentials'

const DEFAULT_PREFIX = 'https://github.com/'
const NEW_TOKEN_ADDRESS = 'https://github.com/settings/personal-access-tokens/new'

/** Hands a token to gitd, which keeps it; brnch never stores the secret. */
export default function TokenConnection({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation('settings')
  const add = useAddGitToken()
  const [urlPrefix, setUrlPrefix] = useState(DEFAULT_PREFIX)
  const [token, setToken] = useState('')
  const [visible, setVisible] = useState(false)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        add.mutate({ urlPrefix, token }, { onSuccess: () => { setToken(''); onSaved() } })
      }}
    >
      <div className="grid grid-cols-[1.15fr_1fr] gap-5">
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted">{t('connections.token.prefix')}</span>
            <input value={urlPrefix} onChange={event => setUrlPrefix(event.target.value)} className="field font-mono text-[12.5px]" autoComplete="off" />
            <span className="text-[12px] text-muted">{t('connections.token.prefixHint')}</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="git-token" className="text-[12px] text-muted">{t('connections.token.label')}</label>
            <div className="flex gap-2">
              <input id="git-token" type={visible ? 'text' : 'password'} value={token} onChange={event => setToken(event.target.value)} className="field flex-1 font-mono text-[12.5px]" autoComplete="off" placeholder="github_pat_…" />
              <Button variant="outline" aria-label={visible ? t('connections.token.hide') : t('connections.token.show')} icon={visible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />} onClick={() => setVisible(!visible)} />
            </div>
          </div>
          <p className="text-[12px] text-muted">{t('connections.token.handed')}</p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-canvas p-4">
          <p className="font-semibold">{t('connections.token.permissions')}</p>
          {(['contents', 'pulls', 'metadata'] as const).map(permission => (
            <p key={permission} className="flex items-center gap-2"><CheckIcon size={14} className="text-ok" />{t(`connections.token.permission.${permission}`)}</p>
          ))}
          <p className="text-[12px] text-muted">{t('connections.token.fineGrained')}</p>
          <div><Button variant="outline" className="h-7" icon={<ExternalLinkIcon size={14} />} onClick={() => void openExternal(NEW_TOKEN_ADDRESS)}>{t('connections.token.create')}</Button></div>
        </div>
      </div>
      <p className="flex items-center gap-2 rounded-lg border border-line px-3.5 py-3 text-muted"><ClockIcon size={14} />{t('connections.token.expires')}</p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-0" onClick={onBack}>{t('connections.cancel')}</Button>
        <span className="flex-1" />
        {add.isError && <span role="alert" className="text-[12.5px] text-danger">{failureText(add.error)}</span>}
        <Button type="submit" loading={add.isPending} disabled={token.trim() === '' || urlPrefix.trim() === ''}>{t('connections.token.save')}</Button>
      </div>
    </form>
  )
}
