import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, FolderIcon, KeyRoundIcon, ShieldCheckIcon, UserIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { useDialog } from '@/hooks/use_dialog'
import { cn } from '@/lib/utils'
import { useProjects } from '@/modules/projects'
import { PublishConnection, classifyGitdFailure, useAgentInstallations, useGitCredentials, useGitdStatus, useSandboxStatus, useSetupAgentAccount } from '@/modules/settings'
import { failureText } from '@/lib/tauri'
import { markOnboarded } from '../lib/onboarded'

const STEPS = ['gitd', 'isolation', 'agents', 'credential', 'project'] as const

/** The first start: each step shows the real state of this machine and how to fix what is missing. */
export default function OnboardingWizard() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const addProject = useDialog('add-project')
  const [index, setIndex] = useState(0)
  const step = STEPS[index] ?? 'gitd'
  const gitd = useGitdStatus()
  const savedCredentials = useGitCredentials(gitd.data?.connected === true)
  const gitdFailure = classifyGitdFailure(gitd.data?.message ?? null)
  const sandbox = useSandboxStatus()
  const agents = useAgentInstallations()
  const { data: projects = [] } = useProjects()
  const setup = useSetupAgentAccount()
  const claude = agents.data?.find(installation => installation.kind === 'claude_code')

  const finish = () => {
    markOnboarded()
    navigate('/', { replace: true })
  }
  const state = {
    gitd: gitd.isPending ? 'checking' : gitd.data?.connected ? 'ok' : 'problem',
    isolation: sandbox.isPending ? 'checking' : sandbox.data?.available ? 'ok' : 'problem',
    agents: agents.isPending ? 'checking' : claude?.installed ? 'ok' : 'problem',
    credential: gitd.isPending ? 'checking' : (savedCredentials.data?.length ?? 0) > 0 ? 'ok' : 'problem',
    project: projects.length > 0 ? 'ok' : 'problem',
  } as const

  return (
    <main className="flex flex-1 flex-col items-center gap-7 overflow-y-auto px-6 pt-12">
      <ol className="flex w-190 items-center" aria-label={t('steps')}>
        {STEPS.map((key, position) => (
          <li key={key} className="flex flex-1 items-center last:flex-none">
            <span className={cn('flex size-6 items-center justify-center rounded-full border text-[12px] font-semibold', position === index ? 'border-ink bg-ink text-canvas' : state[key] === 'ok' ? 'border-ok bg-ok text-[#06140d]' : 'border-line text-muted')}>
              {state[key] === 'ok' && position !== index ? <CheckIcon size={12} /> : position + 1}
            </span>
            <span className={cn('mx-2', position === index ? 'font-medium' : 'text-muted')}>{t(`${key}.name`)}</span>
            {position < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>
      <section className="w-190 rounded-xl border border-line bg-card p-7">
        <p className="text-[12px] text-muted">{t('stepOf', { current: index + 1, total: STEPS.length })}</p>
        <h1 className="mt-1 text-[22px] font-semibold">{t(`${step}.title`)}</h1>
        <p className="mt-2.5 max-w-150 leading-relaxed text-[#c4c4cc]">{t(`${step}.description`)}</p>
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-3.5">
          {state[step] === 'checking' && <Badge>{t('checking')}</Badge>}
          {state[step] === 'ok' && <Badge variant="success">{t('ok')}</Badge>}
          {state[step] === 'problem' && <Badge variant="warning">{t('problem')}</Badge>}
          <p className="flex-1 text-muted">
            {step === 'gitd' && (gitd.data?.connected ? t('gitd.connected') : gitdFailure === 'access_denied' ? t('gitd.accessDenied') : gitdFailure === 'not_running' ? t('gitd.notRunning') : (gitd.data?.message ?? t('gitd.hint')))}
            {step === 'isolation' && (sandbox.data?.available ? t('isolation.active', { mechanism: sandbox.data.mechanism }) : (sandbox.data?.reason ?? t('isolation.unknown')))}
            {step === 'agents' && (claude?.installed ? t('agents.found', { version: claude.version ?? '' }) : t('agents.missing'))}
            {step === 'credential' && (!gitd.data?.connected ? t('credential.needsGitd') : (savedCredentials.data?.length ?? 0) > 0 ? t('credential.savedCount', { count: savedCredentials.data?.length ?? 0 }) : t('credential.reachable'))}
            {step === 'project' && (projects.length > 0 ? t('project.added', { count: projects.length }) : t('project.none'))}
          </p>
          {step === 'gitd' && <Button variant="outline" loading={gitd.isFetching} onClick={() => void gitd.refetch()}>{t('retry')}</Button>}
          {step === 'agents' && <Button variant="outline" loading={agents.isFetching} onClick={() => void agents.refetch()}>{t('retry')}</Button>}
          {step === 'project' && <Button variant="outline" onClick={() => addProject.show()}>{t('project.add')}</Button>}
          {step === 'credential' && <Button variant="outline" loading={gitd.isFetching} onClick={() => void gitd.refetch()}>{t('retry')}</Button>}
        </div>
        {step === 'isolation' && !sandbox.isPending && !sandbox.data?.available && (
          <>
            <div className="mt-4 rounded-lg border border-line">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><span className="flex items-center gap-2 text-muted"><UserIcon size={14} />{t('isolation.account')}</span><span className="font-mono text-[12.5px]">brnchagent</span></div>
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><span className="flex items-center gap-2 text-muted"><KeyRoundIcon size={14} />{t('isolation.password')}</span><span>{t('isolation.passwordValue')}</span></div>
              <div className="flex items-center justify-between px-4 py-2.5"><span className="flex items-center gap-2 text-muted"><FolderIcon size={14} />{t('isolation.access')}</span><span>{t('isolation.accessValue')}</span></div>
            </div>
            <div className="mt-4 flex gap-2.5 rounded-lg border border-[#4a3a14] bg-[#1a150a] px-3.5 py-3 leading-relaxed text-[#e8d9a3]"><AlertTriangleIcon size={14} className="mt-1 shrink-0 text-warn" /><span>{t('isolation.adminWarning')}</span></div>
            <div className="mt-4 flex items-center justify-end gap-3">{setup.isError && <span role="alert" className="text-[12.5px] text-danger">{failureText(setup.error)}</span>}<Button loading={setup.isPending} onClick={() => setup.mutate()} icon={<ShieldCheckIcon size={13} />}>{t('isolation.create')}</Button></div>
          </>
        )}
        {step === 'gitd' && !gitd.data?.connected && gitd.data?.message && gitdFailure !== 'other' && (
          <details className="mt-3 text-[12px] text-muted"><summary className="cursor-pointer">{t('gitd.detail')}</summary><p className="mt-1.5 font-mono">{gitd.data.message}</p></details>
        )}
        {step === 'credential' && gitd.data?.connected && (
          <div className="mt-4"><PublishConnection /></div>
        )}
        <div className="mt-6 flex items-center gap-2.5">
          <Button variant="ghost" className="px-0" onClick={finish}>{t('skip')}</Button>
          <span className="flex-1" />
          <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>{t('back')}</Button>
          {index < STEPS.length - 1 ? (
            <Button icon={<ArrowRightIcon size={13} />} onClick={() => setIndex(index + 1)}>{t('next')}</Button>
          ) : (
            <Button onClick={finish}>{t('finish')}</Button>
          )}
        </div>
      </section>
      <p className="text-[12px] text-muted">{t('later')}</p>
    </main>
  )
}
