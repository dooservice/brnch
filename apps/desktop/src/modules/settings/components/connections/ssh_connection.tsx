import { CheckCircle2Icon, CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { failureText, openExternal } from '@/lib/tauri'
import { useCreateSshKey, useVerifySshKey } from '../../api/use_git_credentials'

const NEW_KEY_ADDRESS = 'https://github.com/settings/ssh/new'
const GITHUB_HOST = 'https://github.com/'

/** Makes a key for this computer, sends the person to add it on GitHub, and proves it works. */
export default function SshConnection({ onBack, onFinished }: { onBack: () => void; onFinished: () => void }) {
  const { t } = useTranslation('settings')
  const { mutate: createKey, data: key, error: keyError } = useCreateSshKey()
  const verify = useVerifySshKey()
  const [repository, setRepository] = useState(GITHUB_HOST)
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    createKey()
  }, [createKey])

  const refused = verify.data !== undefined && !verify.data.enabled
  return (
    <div className="flex flex-col gap-3.5">
      <section className="flex flex-col gap-2.5 rounded-[10px] border border-line p-4">
        <div className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-ok text-[#06140d]"><CheckIcon size={12} /></span><p className="font-semibold">{t('connections.ssh.created')}</p><Badge variant="success">ed25519</Badge></div>
        <p className="text-[12px] text-muted">{t('connections.ssh.publicKey')}</p>
        <div className="flex items-start gap-2">
          <p className="flex-1 break-all rounded-md border border-line bg-canvas p-2.5 font-mono text-[11.5px] leading-relaxed" aria-label={t('connections.ssh.publicKey')}>{key?.publicKey ?? '…'}</p>
          <Button variant="outline" icon={<CopyIcon size={14} />} disabled={!key} onClick={() => key && void navigator.clipboard.writeText(key.publicKey)}>{t('connections.ssh.copy')}</Button>
        </div>
        {keyError && <p role="alert" className="text-danger">{failureText(keyError)}</p>}
        <p className="text-[12px] text-muted">{t('connections.ssh.private', { fingerprint: key?.fingerprint ?? '' })}</p>
      </section>
      <section className="flex flex-col gap-2.5 rounded-[10px] border border-line p-4">
        <div className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-canvas">2</span><p className="font-semibold">{t('connections.ssh.addTitle')}</p></div>
        <p className="text-[12px] text-muted">{t('connections.ssh.addHint')}</p>
        <div><Button variant="outline" icon={<ExternalLinkIcon size={14} />} onClick={() => void openExternal(NEW_KEY_ADDRESS)}>{t('connections.ssh.add')}</Button></div>
      </section>
      <section className="flex flex-col gap-2.5 rounded-[10px] border border-line p-4">
        <div className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full border border-line text-[12px] font-semibold text-muted">3</span><p className="font-semibold">{t('connections.ssh.checkTitle')}</p></div>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); verify.mutate(repository) }}>
          <label className="sr-only" htmlFor="ssh-repository">{t('connections.ssh.repository')}</label>
          <input id="ssh-repository" value={repository} onChange={event => setRepository(event.target.value)} className="field flex-1 font-mono text-[12.5px]" autoComplete="off" />
          <Button type="submit" loading={verify.isPending} disabled={!key || repository.trim() === ''}>{t('connections.ssh.check')}</Button>
        </form>
        {verify.data?.enabled && <p className="flex items-center gap-2 text-ok"><CheckCircle2Icon size={14} />{t('connections.ssh.ok')}</p>}
        {refused && <p role="alert" className="text-warn">{t('connections.ssh.refused')}{verify.data.access.failure !== '' && ` (${verify.data.access.failure})`}</p>}
        {verify.isError && <p role="alert" className="text-danger">{failureText(verify.error)}</p>}
      </section>
      <div className="flex items-center">
        <Button variant="ghost" className="px-0" onClick={onBack}>{t('connections.cancel')}</Button>
        <span className="flex-1" />
        {verify.data?.enabled && <Button onClick={onFinished}>{t('connections.done')}</Button>}
      </div>
    </div>
  )
}
