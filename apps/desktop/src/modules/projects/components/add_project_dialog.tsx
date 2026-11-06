import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import Button from '@/components/button'
import Dialog from '@/components/dialog'
import InputField from '@/components/input_field'
import { useDialog } from '@/hooks/use_dialog'
import { failureText } from '@/lib/tauri'
import { useAddProject } from '@/modules/projects/api/use_projects'

const SCP_LIKE = /^[\w.-]+@[\w.-]+:.+/

function isRepositoryUrl(value: string): boolean {
  try {
    return ['http:', 'https:', 'ssh:'].includes(new URL(value).protocol)
  } catch {
    return SCP_LIKE.test(value)
  }
}

const schema = z.object({
  name: z.string().trim().min(1, 'nameRequired'),
  repositoryUrl: z.string().trim().refine(isRepositoryUrl, 'urlInvalid'),
})

type Values = z.infer<typeof schema>

/** Asks for the two things a project needs today: a name and where its repository lives. */
export default function AddProjectDialog() {
  const { t } = useTranslation('projects')
  const dialog = useDialog('add-project')
  const add = useAddProject()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) })

  const submit = handleSubmit(async values => {
    await add.mutateAsync(values)
    reset()
    dialog.hide()
  })

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={open => (open ? dialog.show() : dialog.hide())}
      title={t('add.title')}
      description={t('add.description')}
      className="w-140"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={dialog.hide}>{t('cancel', { ns: 'common' })}</Button>
          <Button type="submit" form="add-project-form" loading={add.isPending}>{t('add.submit')}</Button>
        </>
      }
    >
      <form id="add-project-form" onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 py-4">
        <InputField label={t('add.name')} error={errors.name ? t(`add.errors.${errors.name.message as 'nameRequired'}`) : null}>
          <input {...register('name')} aria-invalid={errors.name !== undefined} className="field" autoFocus />
        </InputField>
        <InputField label={t('add.url')} error={errors.repositoryUrl ? t(`add.errors.${errors.repositoryUrl.message as 'urlInvalid'}`) : null}>
          <input {...register('repositoryUrl')} aria-invalid={errors.repositoryUrl !== undefined} placeholder="https://github.com/acme/web-store" className="field font-mono text-[12.5px]" />
        </InputField>
        {add.isError && <p role="alert" className="text-[12.5px] text-danger">{failureText(add.error)}</p>}
      </form>
    </Dialog>
  )
}
