import { ArrowRightIcon, CheckIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { useDialog } from '@/hooks/use_dialog'
import { cn } from '@/lib/utils'
import { useProjects } from '@/modules/projects'
import { useAgentInstallations, useGitdStatus, useSandboxStatus } from '@/modules/settings'
import { markOnboarded } from '../lib/onboarded'

const STEPS = ['gitd', 'isolation', 'agents', 'project'] as const

/** The first start: each step shows the real state of this machine and how to fix what is missing. */
export default function OnboardingWizard() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const addProject = useDialog('add-project')
  const [index, setIndex] = useState(0)
  const step = STEPS[index] ?? 'gitd'
  const gitd = useGitdStatus()
  const sandbox = useSandboxStatus()
  const agents = useAgentInstallations()
  const { data: projects = [] } = useProjects()
  const claude = agents.data?.find(installation => installation.kind === 'claude_code')

  const finish = () => {
    markOnboarded()
    navigate('/', { replace: true })
  }
  const state = {
    gitd: gitd.isPending ? 'checking' : gitd.data?.connected ? 'ok' : 'problem',
    isolation: sandbox.isPending ? 'checking' : sandbox.data?.available ? 'ok' : 'problem',
    agents: agents.isPending ? 'checking' : claude?.installed ? 'ok' : 'problem',
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
            {step === 'gitd' && (gitd.data?.message ?? (gitd.data?.connected ? t('gitd.connected') : t('gitd.hint')))}
            {step === 'isolation' && (sandbox.data?.available ? t('isolation.active', { mechanism: sandbox.data.mechanism }) : (sandbox.data?.reason ?? t('isolation.unknown')))}
            {step === 'agents' && (claude?.installed ? t('agents.found', { version: claude.version ?? '' }) : t('agents.missing'))}
            {step === 'project' && (projects.length > 0 ? t('project.added', { count: projects.length }) : t('project.none'))}
          </p>
          {step === 'gitd' && <Button variant="outline" loading={gitd.isFetching} onClick={() => void gitd.refetch()}>{t('retry')}</Button>}
          {step === 'agents' && <Button variant="outline" loading={agents.isFetching} onClick={() => void agents.refetch()}>{t('retry')}</Button>}
          {step === 'project' && <Button variant="outline" onClick={() => addProject.show()}>{t('project.add')}</Button>}
        </div>
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
