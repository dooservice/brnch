import { zodResolver } from '@hookform/resolvers/zod'
import { BotIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon, GitBranchIcon, LockIcon, MinusIcon, PlayIcon, PlusIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import Button from '@/components/button'
import Dialog from '@/components/dialog'
import InputField from '@/components/input_field'
import Kbd from '@/components/kbd'
import { useDialog } from '@/hooks/use_dialog'
import { BRANCH_PREFIX, MAXIMUM_RUN_COPIES } from '@/lib/constants'
import { useDefaultPermission } from '@/lib/preferences'
import { failureText } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useActiveProjectId, useProjects, useRepositoryInspection } from '@/modules/projects'
import { useAgentInstallations, useSandboxStatus } from '@/modules/settings'
import { useStartRun } from '../api/use_start_run'
import { deriveRunLabel } from '../lib/run_label'

const schema = z.object({
  projectIdentifier: z.string().min(1, 'projectRequired'),
  baseBranch: z.string().trim(),
  prompt: z.string().trim().min(1, 'promptRequired'),
  useClaude: z.boolean(),
  copies: z.number().int().min(1).max(MAXIMUM_RUN_COPIES),
  permissionMode: z.enum(['edit_files', 'plan_only']),
  maximumMinutes: z.string().trim().refine(value => value === '' || /^[1-9]\d{0,3}$/.test(value), 'minutesInvalid'),
})

type Values = z.infer<typeof schema>

const OTHER_AGENTS = ['Codex', 'Gemini CLI', 'OpenCode'] as const

/** "Nueva corrida": one task, handed to one or several copies of an agent. */
export default function NewRunDialog() {
  const { t } = useTranslation('runs')
  const dialog = useDialog('new-run')
  const start = useStartRun()
  const { data: projects = [] } = useProjects()
  const activeProjectId = useActiveProjectId()
  const { data: installations } = useAgentInstallations()
  const { data: sandbox } = useSandboxStatus()
  const [defaultPermission] = useDefaultPermission()
  const [advanced, setAdvanced] = useState(false)
  const claude = installations?.find(installation => installation.kind === 'claude_code')
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { projectIdentifier: '', baseBranch: '', prompt: '', useClaude: true, copies: 1, permissionMode: defaultPermission, maximumMinutes: '' },
  })
  const projectIdentifier = watch('projectIdentifier')
  const project = projects.find(candidate => candidate.identifier === projectIdentifier)
  const inspection = useRepositoryInspection(project?.repositoryUrl ?? '')
  const branches = inspection.data?.branches ?? []
  const baseBranch = watch('baseBranch')
  const branchOptions = baseBranch !== '' && !branches.includes(baseBranch) ? [baseBranch, ...branches] : branches
  const copies = watch('copies')
  const useClaude = watch('useClaude')
  const workspaceCount = useClaude ? copies : 0

  useEffect(() => {
    if (dialog.open && projectIdentifier === '' && (activeProjectId ?? projects[0]?.identifier)) {
      setValue('projectIdentifier', activeProjectId ?? projects[0]!.identifier)
    }
  }, [dialog.open, projectIdentifier, activeProjectId, projects, setValue])

  // Changing project starts from that project's own base branch.
  useEffect(() => {
    if (project !== undefined) setValue('baseBranch', project.baseBranch ?? inspection.data?.defaultBranch ?? '')
  }, [project, inspection.data?.defaultBranch, setValue])

  const submit = handleSubmit(async values => {
    if (!values.useClaude) return
    await start.mutateAsync({
      projectIdentifier: values.projectIdentifier,
      runLabel: deriveRunLabel(values.prompt),
      prompt: values.prompt,
      agentKind: 'claude_code',
      permissionMode: values.permissionMode,
      baseBranch: values.baseBranch === '' ? null : values.baseBranch,
      copies: values.copies,
      maximumMinutes: values.maximumMinutes === '' ? null : Number(values.maximumMinutes),
    })
    reset({ projectIdentifier: values.projectIdentifier, baseBranch: '', prompt: '', useClaude: true, copies: 1, permissionMode: defaultPermission, maximumMinutes: '' })
    dialog.hide()
  })
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit()
  }
  const row = 'flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0'

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={open => (open ? dialog.show() : dialog.hide())}
      title={t('new.title')}
      description={t('new.description')}
      className="w-170 top-10"
      footer={
        <>
          <span className={cn('flex flex-1 items-center gap-2 text-[12px]', sandbox?.available === false ? 'text-warn' : 'text-muted')}>
            {sandbox?.available === false ? <ShieldAlertIcon size={14} /> : <ShieldCheckIcon size={14} className="text-ok" />}
            {sandbox?.available === false ? t('new.notConfined') : t('new.willCreate', { count: workspaceCount })}
          </span>
          <Button variant="ghost" onClick={dialog.hide}>{t('cancel', { ns: 'common' })}</Button>
          <Button type="submit" form="new-run-form" icon={<PlayIcon size={13} />} loading={start.isPending} disabled={!project || !useClaude}>
            {t('new.launch', { count: workspaceCount })}
            <Kbd className="border-[#c9c9d0] text-[#55555e]">Ctrl ↵</Kbd>
          </Button>
        </>
      }
    >
      <form id="new-run-form" onSubmit={submit} onKeyDown={onKeyDown} noValidate className="flex flex-col gap-4 px-5 py-4.5">
        <div className="flex gap-3">
          <InputField label={t('new.project')} error={errors.projectIdentifier ? t('new.errors.projectRequired') : null} className="flex-1">
            <div className="relative">
              <FolderIcon size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
              <select {...register('projectIdentifier')} className="field appearance-none pl-8">
                {projects.map(candidate => <option key={candidate.identifier} value={candidate.identifier}>{candidate.name}</option>)}
              </select>
              <ChevronDownIcon size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
            </div>
          </InputField>
          <InputField label={t('new.baseBranch')} className="flex-1">
            <div className="relative">
              <GitBranchIcon size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
              <select {...register('baseBranch')} disabled={branchOptions.length === 0} className="field appearance-none pl-8 font-mono text-[12.5px]">
                {branchOptions.length === 0 ? <option value="">{t('new.baseBranchDefault')}</option> : branchOptions.map(branch => <option key={branch} value={branch}>{branch}</option>)}
              </select>
              <ChevronDownIcon size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
            </div>
          </InputField>
        </div>
        <InputField label={t('new.task')} hint={t('new.taskHint')} error={errors.prompt ? t('new.errors.promptRequired') : null}>
          <textarea {...register('prompt')} aria-invalid={errors.prompt !== undefined} rows={4} autoFocus placeholder={t('new.taskPlaceholder')} className="field h-auto resize-none py-2 leading-relaxed" />
        </InputField>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium" id="agents-label">{t('new.agents')}</span>
          <div aria-labelledby="agents-label" className="overflow-hidden rounded-lg border border-line">
            <div className={row}>
              <Controller control={control} name="useClaude" render={({ field }) => (
                <label className="flex cursor-pointer items-center">
                  <input type="checkbox" checked={field.value} onChange={event => field.onChange(event.target.checked)} aria-label="Claude Code" className="sr-only" />
                  <span className={cn('flex size-3.75 items-center justify-center rounded border', field.value ? 'border-ink bg-ink text-canvas' : 'border-[#3a3a42]')}>{field.value && <CheckIcon size={11} />}</span>
                </label>
              )} />
              <BotIcon size={16} className="text-muted" />
              <div className="flex-1">
                <p className="font-medium">Claude Code</p>
                <p className={cn('text-[12px]', claude?.installed === false ? 'text-warn' : 'text-muted')}>{claude === undefined ? t('new.checking') : claude.installed ? t('new.installed', { version: claude.version ?? '' }) : t('new.notInstalled')}</p>
              </div>
              <Controller control={control} name="copies" render={({ field }) => (
                <div className="flex h-7 items-center rounded-md border border-line" role="group" aria-label={t('new.copies')}>
                  <button type="button" aria-label={t('new.fewer')} disabled={field.value <= 1} onClick={() => field.onChange(field.value - 1)} className="flex w-7 justify-center text-muted disabled:opacity-40"><MinusIcon size={14} /></button>
                  <output aria-label={t('new.copyCount')} className="w-6 text-center font-mono">{field.value}</output>
                  <button type="button" aria-label={t('new.more')} disabled={field.value >= MAXIMUM_RUN_COPIES} onClick={() => field.onChange(field.value + 1)} className="flex w-7 justify-center text-muted disabled:opacity-40"><PlusIcon size={14} /></button>
                </div>
              )} />
            </div>
            {OTHER_AGENTS.map(name => (
              <div key={name} className={cn(row, 'opacity-70')}>
                <span className="size-3.75 rounded border border-[#3a3a42]" />
                <BotIcon size={16} className="text-muted" />
                <div className="flex-1"><p className="font-medium">{name}</p><p className="text-[12px] text-muted">{t('new.pendingVerification')}</p></div>
                <Button variant="outline" disabled className="h-6.5">{t('new.soon')}</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Controller control={control} name="permissionMode" render={({ field }) => (
            <div className="flex flex-[1.4] flex-col gap-1.5">
              <span className="font-medium" id="permissions-label">{t('new.permissions')}</span>
              <div role="radiogroup" aria-labelledby="permissions-label" className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
                {(['edit_files', 'plan_only'] as const).map(mode => (
                  <button key={mode} type="button" role="radio" aria-checked={field.value === mode} onClick={() => field.onChange(mode)} className={cn('flex-1 rounded-md px-2 py-1.5 font-medium', field.value === mode ? 'bg-hover text-ink' : 'text-muted')}>{t(`new.modes.${mode}`)}</button>
                ))}
              </div>
            </div>
          )} />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="font-medium" id="prefix-label">{t('new.prefix')}</span>
            <div aria-labelledby="prefix-label" className="flex h-8.5 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-muted"><LockIcon size={14} /><span className="font-mono text-[12.5px]">{BRANCH_PREFIX}</span></div>
          </div>
        </div>
        <div>
          <button type="button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)} className="flex items-center gap-1.5 text-muted hover:text-ink">
            {advanced ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}{t('new.advanced')}<span className="text-[12px]">· {t('new.advancedHint')}</span>
          </button>
          {advanced && (
            <div className="mt-3 w-60">
              <InputField label={t('new.maximumMinutes')} hint={t('new.maximumMinutesHint')} error={errors.maximumMinutes ? t('new.errors.minutesInvalid') : null}>
                <input {...register('maximumMinutes')} inputMode="numeric" aria-invalid={errors.maximumMinutes !== undefined} className="field font-mono" />
              </InputField>
            </div>
          )}
        </div>
        {start.isError && <p role="alert" className="rounded-md border border-[#5a2326] bg-[#1c0f10] px-3 py-2 text-[12.5px] text-danger">{failureText(start.error)}</p>}
      </form>
    </Dialog>
  )
}
