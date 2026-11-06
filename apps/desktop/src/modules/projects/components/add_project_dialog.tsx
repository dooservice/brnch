import { zodResolver } from '@hookform/resolvers/zod'
import { CheckIcon, ChevronDownIcon, CircleCheckIcon, CircleXIcon, FolderIcon, GitBranchIcon, LinkIcon, LockIcon, ShieldCheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import Button from '@/components/button'
import Dialog from '@/components/dialog'
import InputField from '@/components/input_field'
import { useDebouncedValue } from '@/hooks/use_debounced_value'
import { useDialog } from '@/hooks/use_dialog'
import { pickFolder } from '@/lib/pick_folder'
import { failureText } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useAddProject, useRepositoryInspection } from '@/modules/projects/api/use_projects'

const SCP_LIKE = /^[\w.-]+@[\w.-]+:.+/

function isRepositoryUrl(value: string): boolean {
  try {
    return ['http:', 'https:', 'ssh:'].includes(new URL(value).protocol)
  } catch {
    return SCP_LIKE.test(value)
  }
}

function nameFromLocation(location: string): string {
  const last = location.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  return last.replace(/\.git$/, '')
}

function hostOf(location: string): string | null {
  try {
    return new URL(location).host
  } catch {
    return /^[\w.-]+@([\w.-]+):/.exec(location)?.[1] ?? null
  }
}

const schema = z.object({
  source: z.enum(['url', 'folder']),
  location: z.string().trim().min(1, 'locationRequired'),
  name: z.string().trim().min(1, 'nameRequired'),
  baseBranch: z.string().trim(),
  workspacesDirectory: z.string().trim(),
  open: z.boolean(),
}).refine(values => values.source === 'folder' || isRepositoryUrl(values.location), { path: ['location'], message: 'urlInvalid' })

type Values = z.infer<typeof schema>

const DEFAULTS: Values = { source: 'url', location: '', name: '', baseBranch: '', workspacesDirectory: '', open: true }

/** Adds a project from a URL or a local folder, with where its runs start and where its workspaces go. */
export default function AddProjectDialog() {
  const { t } = useTranslation('projects')
  const dialog = useDialog('add-project')
  const add = useAddProject()
  const { register, handleSubmit, reset, control, watch, setValue, getValues, formState: { errors, dirtyFields } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS })
  const [pickFailure, setPickFailure] = useState<string | null>(null)
  const source = watch('source')
  const location = watch('location')
  const settledLocation = useDebouncedValue(location.trim())
  const inspection = useRepositoryInspection(source === 'folder' || isRepositoryUrl(settledLocation) ? settledLocation : '')
  const checking = location.trim() !== '' && (settledLocation !== location.trim() || inspection.isFetching)
  const accessible = !checking && inspection.data?.accessible === true
  const refused = !checking && inspection.data?.accessible === false && settledLocation !== ''
  const host = hostOf(location)

  // What the repository says about itself fills in what the person has not typed yet.
  useEffect(() => {
    if (!accessible || inspection.data === undefined) return
    if (!dirtyFields.name && getValues('name') === '') setValue('name', nameFromLocation(settledLocation))
    if (getValues('baseBranch') === '' && inspection.data.defaultBranch) setValue('baseBranch', inspection.data.defaultBranch)
  }, [accessible, inspection.data, settledLocation, dirtyFields.name, getValues, setValue])

  const submit = handleSubmit(async values => {
    await add.mutateAsync({
      name: values.name,
      repositoryUrl: values.location,
      baseBranch: values.baseBranch === '' ? null : values.baseBranch,
      workspacesDirectory: values.workspacesDirectory === '' ? null : values.workspacesDirectory,
      open: values.open,
    })
    reset(DEFAULTS)
    dialog.hide()
  })

  const chooseFolder = async (field: 'location' | 'workspacesDirectory') => {
    setPickFailure(null)
    try {
      const chosen = await pickFolder(t(field === 'location' ? 'add.pickRepository' : 'add.pickWorkspaces'))
      if (chosen !== null) setValue(field, chosen, { shouldDirty: true, shouldValidate: true })
    } catch (error) {
      setPickFailure(failureText(error))
    }
  }
  const branches = inspection.data?.branches ?? []
  const baseBranch = watch('baseBranch')
  const options = baseBranch !== '' && !branches.includes(baseBranch) ? [baseBranch, ...branches] : branches
  const locationError = errors.location ? t(`add.errors.${errors.location.message as 'locationRequired'}`) : null

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={open => (open ? dialog.show() : dialog.hide())}
      title={t('add.title')}
      description={t('add.description')}
      className="w-140 top-16"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={dialog.hide}>{t('cancel', { ns: 'common' })}</Button>
          <Button type="submit" form="add-project-form" loading={add.isPending}>{t('add.submit')}</Button>
        </>
      }
    >
      <form id="add-project-form" onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 py-4.5">
        <Controller
          control={control}
          name="source"
          render={({ field }) => (
            <div role="radiogroup" aria-label={t('add.source')} className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
              {(['url', 'folder'] as const).map(option => (
                <button key={option} type="button" role="radio" aria-checked={field.value === option} onClick={() => { field.onChange(option); setValue('location', ''); setValue('baseBranch', '') }} className={cn('flex-1 rounded-md px-2 py-1.5 font-medium', field.value === option ? 'bg-hover text-ink' : 'text-muted')}>{t(`add.sources.${option}`)}</button>
              ))}
            </div>
          )}
        />
        {source === 'url' ? (
          <InputField label={t('add.url')} error={locationError}>
            <div className={cn('flex h-8.5 items-center gap-2 rounded-md border bg-canvas px-2.5', accessible ? 'border-[#1d4a33]' : refused || locationError ? 'border-danger' : 'border-line')}>
              <LinkIcon size={14} className="text-muted" />
              <input {...register('location')} aria-invalid={locationError !== null} placeholder="https://github.com/acme/web-store" className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none" autoFocus />
              {accessible && <CircleCheckIcon size={14} className="text-ok" />}
              {refused && <CircleXIcon size={14} className="text-danger" />}
            </div>
          </InputField>
        ) : (
          <InputField label={t('add.folder')} error={locationError}>
            <div className="flex gap-2">
              <div className={cn('flex h-8.5 flex-1 items-center gap-2 rounded-md border bg-canvas px-2.5', accessible ? 'border-[#1d4a33]' : refused || locationError ? 'border-danger' : 'border-line')}>
                <FolderIcon size={14} className="text-muted" />
                <input {...register('location')} aria-invalid={locationError !== null} placeholder="D:\code\web-store" className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none" />
                {accessible && <CircleCheckIcon size={14} className="text-ok" />}
              </div>
              <Button variant="outline" className="h-8.5" onClick={() => void chooseFolder('location')}>{t('add.browse')}</Button>
            </div>
          </InputField>
        )}
        {location.trim() !== '' && (
          <p aria-live="polite" className={cn('-mt-2.5 text-[12px]', accessible ? 'text-ok' : refused ? 'text-danger' : 'text-muted')}>
            {checking ? t('add.checking') : accessible ? t('add.reachable', { branch: inspection.data?.defaultBranch ?? '—' }) : refused ? (inspection.data?.message ?? t('add.unreachable')) : ''}
          </p>
        )}
        <div className="flex gap-3">
          <InputField label={t('add.name')} error={errors.name ? t(`add.errors.${errors.name.message as 'nameRequired'}`) : null} className="flex-1">
            <input {...register('name')} aria-invalid={errors.name !== undefined} className="field" />
          </InputField>
          <InputField label={t('add.baseBranch')} className="flex-1">
            <div className="relative">
              <GitBranchIcon size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
              <select {...register('baseBranch')} disabled={options.length === 0} className="field appearance-none pl-8 font-mono text-[12.5px]">
                {options.length === 0 ? <option value="">{t('add.baseBranchDefault')}</option> : options.map(branch => <option key={branch} value={branch}>{branch}</option>)}
              </select>
              <ChevronDownIcon size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
            </div>
          </InputField>
        </div>
        <InputField label={t('add.workspaces')} hint={t('add.workspacesHint')}>
          <div className="flex gap-2">
            <div className="flex h-8.5 flex-1 items-center gap-2 rounded-md border border-line bg-canvas px-2.5">
              <FolderIcon size={14} className="text-muted" />
              <input {...register('workspacesDirectory')} aria-label={t('add.workspaces')} placeholder={t('add.workspacesDefault')} className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none" />
            </div>
            <Button variant="outline" className="h-8.5" onClick={() => void chooseFolder('workspacesDirectory')}>{t('add.browse')}</Button>
          </div>
        </InputField>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium" id="credential-label">{t('add.credential')}</span>
          <div aria-labelledby="credential-label" className="flex h-8.5 items-center gap-2 rounded-md border border-line bg-canvas px-2.5">
            <LockIcon size={14} className="text-muted" />
            <span className="flex-1 truncate">{host ? t('add.credentialFor', { host }) : t('add.credentialDefault')}</span>
            <ChevronDownIcon size={14} className="text-muted" />
          </div>
          <p className="flex items-start gap-1.5 text-[12px] text-muted"><ShieldCheckIcon size={13} className="mt-px shrink-0 text-ok" />{t('add.credentialNote')}</p>
        </div>
        <Controller
          control={control}
          name="open"
          render={({ field }) => (
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={field.value} onChange={event => field.onChange(event.target.checked)} className="sr-only" />
              <span className={cn('flex size-3.75 items-center justify-center rounded border', field.value ? 'border-ink bg-ink text-canvas' : 'border-[#3a3a42]')}>{field.value && <CheckIcon size={11} />}</span>
              {t('add.openAfter')}
            </label>
          )}
        />
        {(add.isError || pickFailure) && <p role="alert" className="text-[12.5px] text-danger">{pickFailure ?? failureText(add.error)}</p>}
      </form>
    </Dialog>
  )
}
