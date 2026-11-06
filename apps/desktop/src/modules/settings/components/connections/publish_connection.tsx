import { ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/button'
import { useGitCredentials } from '../../api/use_git_credentials'
import ConnectionChoices, { type ConnectionMethod } from './connection_choices'
import ConnectionsList from './connections_list'
import GithubSignIn from './github_sign_in'
import SshConnection from './ssh_connection'
import TokenConnection from './token_connection'

type View = 'list' | 'choose' | ConnectionMethod

/** Connects gitd to GitHub: pick a way, finish it, and see what is connected. */
export default function PublishConnection() {
  const { t } = useTranslation('settings')
  const credentials = useGitCredentials(true)
  const [view, setView] = useState<View | null>(null)
  const current: View = view ?? ((credentials.data?.length ?? 0) > 0 ? 'list' : 'choose')
  const toList = () => setView('list')

  return (
    <div className="flex flex-col gap-4">
      {current === 'choose' && <ConnectionChoices onChoose={setView} />}
      {current === 'github' && <GithubSignIn onBack={() => setView('choose')} onFinished={toList} />}
      {current === 'token' && <TokenConnection onBack={() => setView('choose')} onSaved={toList} />}
      {current === 'ssh' && <SshConnection onBack={() => setView('choose')} onFinished={toList} />}
      {current === 'list' && (
        <>
          <ConnectionsList />
          <div><Button variant="outline" onClick={() => setView('choose')}>{t('connections.addAnother')}</Button></div>
        </>
      )}
      <p className="flex items-start gap-2 rounded-lg border border-[#1d4a33] bg-[#0a1a12] px-3.5 py-3 leading-relaxed text-[#bfe9d1]"><ShieldCheckIcon size={14} className="mt-1 shrink-0 text-ok" /><span>{t('connections.agentsNever')}</span></p>
    </div>
  )
}
