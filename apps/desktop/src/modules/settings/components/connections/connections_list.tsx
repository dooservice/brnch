import { KeyRoundIcon, LockIcon, TrashIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import GithubMark from '@/components/github_mark'
import { useGitCredentials, useRemoveGitCredential, useRemoveSshKey } from '../../api/use_git_credentials'
import type { GitCredential } from '../../types/settings.types'

const ICONS = { token: LockIcon, ssh_key: KeyRoundIcon, github_app: GithubMark, github_login: GithubMark, other: LockIcon } as const

function title(credential: GitCredential): string {
  return credential.actsAs !== '' ? `@${credential.actsAs}` : credential.urlPrefix
}

/** What gitd keeps for publishing: each connection with its kind, and a way to forget it. */
export default function ConnectionsList({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation('settings')
  const credentials = useGitCredentials(enabled)
  const remove = useRemoveGitCredential()
  const removeKey = useRemoveSshKey()
  return (
    <ul className="overflow-hidden rounded-[10px] border border-line bg-card" aria-label={t('connections.saved')}>
      {(credentials.data ?? []).map(credential => {
        const Icon = ICONS[credential.kind]
        return (
          <li key={credential.identifier} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-canvas"><Icon size={16} /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{title(credential)}</p><p className="truncate text-[12px] text-muted">{t(`connections.kind.${credential.kind}`, { prefix: credential.urlPrefix })}</p></div>
            <Badge variant={credential.kind === 'github_login' ? 'success' : 'muted'}>{t(`connections.badge.${credential.kind}`)}</Badge>
            <Button variant="ghost" className="h-7" aria-label={t('connections.forget', { name: title(credential) })} icon={<TrashIcon size={14} />} onClick={() => (credential.kind === 'ssh_key' ? removeKey.mutate() : remove.mutate(credential.identifier))}>{t('connections.remove')}</Button>
          </li>
        )
      })}
      {credentials.data?.length === 0 && <li className="px-4 py-3.5 text-muted">{t('connections.none')}</li>}
    </ul>
  )
}
