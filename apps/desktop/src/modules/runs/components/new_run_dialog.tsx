import { zodResolver } from '@hookform/resolvers/zod'
import { BotIcon, GitBranchIcon, MinusIcon, PlayIcon, PlusIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import Button from '@/components/button'
import Dialog from '@/components/dialog'
import InputField from '@/components/input_field'
import { useDialog } from '@/hooks/use_dialog'
import { MAXIMUM_RUN_COPIES } from '@/lib/constants'
import { failureText } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useActiveProjectId, useProjects } from '@/modules/projects'
import { useAgentInstallations } from '@/modules/settings'
import { useStartRun } from '../api/use_start_run'
import { deriveRunLabel } from '../lib/run_label'

const schema = z.object({
  prompt: z.string().trim().min(1, 'promptRequired'),
  baseBranch: z.string().trim(),
  permissionMode: z.enum(['edit_files', 'plan_only']),
  copies: z.number().int().min(1).max(MAXIMUM_RUN_COPIES),
})

type Values = z.infer<typeof schema>

const DEFAULTS: Values = { prompt: '', baseBranch: '', permissionMode: 'edit_files', copies: 1 }

/** "Nueva corrida": one task, handed to one or several copies of an agent. */
export default function NewRunDialog() {
  const { t } = useTranslation('runs')
  const dialog = useDialog('new-run')
  const start = useStartRun()
  const { data: projects = [] } = useProjects()
  const activeProjectId = useActiveProjectId()
  const { data: installations } = useAgentInstallations()
  const project = projects.find(candidate => candidate.identifier === activeProjectId)
  const claudeMissing = installations?.find(installation => installation.kind === 'claude_code')?.installed === false
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS })

  const submit = handleSubmit(async values => {
    if (!project) return
    await start.mutateAsync({
      projectIdentifier: project.identifier,
      runLabel: deriveRunLabel(values.prompt),
      prompt: values.prompt,
      agentKind: 'claude_code',
      permissionMode: values.permissionMode,
      baseBranch: values.baseBranch === '' ? null : values.baseBranch,
      copies: values.copies,
    })
    reset(DEFAULTS)
    dialog.hide()
  })

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={open => (open ? dialog.show() : dialog.hide())}
      title={t('new.title')}
      description={t('new.description')}
      className="w-170 top-14"
      footer={
        <Controller
          control={control}
          name="copies"
          render={({ field }) => (
            <>
              <span className="flex flex-1 items-center gap-2 text-[12px] text-muted"><GitBranchIcon size={14} />{t('new.willCreate', { count: field.value })}</span>
              <Button variant="ghost" onClick={dialog.hide}>{t('cancel', { ns: 'common' })}</Button>
              <Button type="submit" form="new-run-form" icon={<PlayIcon size={13} />} loading={start.isPending} disabled={!project}>{t('new.launch', { count: field.value })}</Button>
            </>
          )}
        />
      }
    >
      <form id="new-run-form" onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 py-4">
        <InputField label={t('new.project')}>
          <div className="flex h-8.5 items-center rounded-md border border-line bg-canvas px-2.5 text-muted">{project?.name ?? t('new.noProject')}</div>
        </InputField>
        <InputField label={t('new.task')} error={errors.prompt ? t('new.errors.promptRequired') : null}>
          <textarea {...register('prompt')} aria-invalid={errors.prompt !== undefined} rows={4} autoFocus placeholder={t('new.taskPlaceholder')} className="field h-auto resize-none py-2 leading-relaxed" />
        </InputField>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium">{t('new.agent')}</span>
          <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <BotIcon size={16} className="text-muted" />
            <div className="flex-1">
              <p className="font-medium">Claude Code</p>
              <p className={cn('text-[12px]', claudeMissing ? 'text-warn' : 'text-muted')}>{claudeMissing ? t('new.notInstalled') : t('new.moreLater')}</p>
            </div>
            <Controller
              control={control}
              name="copies"
              render={({ field }) => (
                <div className="flex h-7 items-center rounded-md border border-line" role="group" aria-label={t('new.copies')}>
                  <button type="button" aria-label={t('new.fewer')} disabled={field.value <= 1} onClick={() => field.onChange(field.value - 1)} className="flex w-7 justify-center text-muted disabled:opacity-40"><MinusIcon size={14} /></button>
                  <output aria-label={t('new.copyCount')} className="w-6 text-center font-mono">{field.value}</output>
                  <button type="button" aria-label={t('new.more')} disabled={field.value >= MAXIMUM_RUN_COPIES} onClick={() => field.onChange(field.value + 1)} className="flex w-7 justify-center text-muted disabled:opacity-40"><PlusIcon size={14} /></button>
                </div>
              )}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Controller
            control={control}
            name="permissionMode"
            render={({ field }) => (
              <div className="flex flex-[1.4] flex-col gap-1.5">
                <span className="font-medium">{t('new.permissions')}</span>
                <div role="radiogroup" aria-label={t('new.permissions')} className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
                  {(['edit_files', 'plan_only'] as const).map(mode => (
                    <button key={mode} type="button" role="radio" aria-checked={field.value === mode} onClick={() => field.onChange(mode)} className={cn('flex-1 rounded-md px-2 py-1.5 font-medium', field.value === mode ? 'bg-hover text-ink' : 'text-muted')}>{t(`new.modes.${mode}`)}</button>
                  ))}
                </div>
              </div>
            )}
          />
          <InputField label={t('new.baseBranch')} hint={t('new.baseBranchHint')} className="flex-1">
            <input {...register('baseBranch')} placeholder="main" className="field font-mono text-[12.5px]" />
          </InputField>
        </div>
        {start.isError && <p role="alert" className="rounded-md border border-[#5a2326] bg-[#1c0f10] px-3 py-2 text-[12.5px] text-danger">{failureText(start.error)}</p>}
      </form>
    </Dialog>
  )
}
