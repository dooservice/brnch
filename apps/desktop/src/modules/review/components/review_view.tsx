import { CheckIcon, FileTextIcon, MessageSquarePlusIcon, SearchIcon, SendIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Badge from '@/components/badge'
import Button from '@/components/button'
import { useDialog } from '@/hooks/use_dialog'
import { failureText } from '@/lib/tauri'
import { parseUnifiedDiff, toSplitRows } from '@/lib/unified_diff'
import type { DiffLine } from '@/lib/unified_diff'
import { cn } from '@/lib/utils'
import { useSendFollowUp, useWorkspaceDiff } from '@/modules/workspaces'
import type { Workspace } from '@/modules/workspaces'
import { buildReviewPrompt } from '../lib/review_prompt'
import { useReviewMarks } from '../lib/review_marks'

const ADDED = 'bg-[#0e2219] text-[#8be0b2]'
const REMOVED = 'bg-[#2a1416] text-[#f1a3a0]'

/** The Cambios tab: what the agent changed, with room to mark files seen and comment on lines. */
export default function ReviewView({ workspace }: { workspace: Workspace }) {
  const { t } = useTranslation('review')
  const navigate = useNavigate()
  const publish = useDialog('publish')
  const marks = useReviewMarks()
  const diff = useWorkspaceDiff(workspace.identifier, workspace.status)
  const sendFollowUp = useSendFollowUp()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [split, setSplit] = useState(false)
  const [commentingOn, setCommentingOn] = useState<{ path: string; line: number } | null>(null)
  const [draft, setDraft] = useState('')
  const workspaceIdentifier = workspace.identifier

  const files = useMemo(() => (diff.data ? parseUnifiedDiff(diff.data.unifiedDiff) : []), [diff.data])
  const visible = files.filter(file => file.path.toLowerCase().includes(filter.toLowerCase()))
  const unreviewed = visible.filter(file => !marks.isViewed(workspaceIdentifier, file.path))
  const reviewed = visible.filter(file => marks.isViewed(workspaceIdentifier, file.path))
  const selected = files.find(file => file.path === selectedPath) ?? unreviewed[0] ?? reviewed[0] ?? null
  const comments = marks.commentsOf(workspaceIdentifier)
  const working = workspace.status === 'running'
  const splitRows = split && selected ? toSplitRows(selected.lines) : []

  const sendToAgent = async () => {
    await sendFollowUp.mutateAsync({ workspaceIdentifier, prompt: buildReviewPrompt(comments) })
    marks.clearComments(workspaceIdentifier)
    navigate(`/workspaces/${workspaceIdentifier}`)
  }
  const addComment = () => {
    if (commentingOn && draft.trim() !== '') marks.addComment(workspaceIdentifier, { path: commentingOn.path, line: commentingOn.line, text: draft.trim() })
    setDraft('')
    setCommentingOn(null)
  }

  if (diff.isPending) return <p className="m-auto text-muted">{t('loading')}</p>
  if (diff.isError) return <p role="alert" className="m-auto max-w-120 text-center text-danger">{failureText(diff.error)}</p>
  if (selected === null) return <p className="m-auto text-muted">{t('noChanges')}</p>

  const fileRow = (path: string, added: number, removed: number) => {
    const seen = marks.isViewed(workspaceIdentifier, path)
    return (
      <li key={path} className={cn('mx-1.5 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover', path === selected.path && 'bg-hover')}>
        <input type="checkbox" checked={seen} onChange={() => marks.toggleViewed(workspaceIdentifier, path)} aria-label={t('markViewed', { path })} className="size-3.5 accent-white" />
        <button type="button" aria-current={path === selected.path} onClick={() => setSelectedPath(path)} className={cn('flex min-w-0 flex-1 items-center gap-2 text-left', seen && 'text-muted')}>
          <FileTextIcon size={14} className="shrink-0 text-muted" />
          <span className="flex-1 truncate font-mono text-[12px]">{path}</span>
          <span className="font-mono text-[11px]"><span className="text-ok">+{added}</span> <span className="text-danger">−{removed}</span></span>
        </button>
      </li>
    )
  }

  const unifiedRow = (line: DiffLine, index: number) => {
    const tint = line.kind === 'add' ? ADDED : line.kind === 'remove' ? REMOVED : line.kind === 'hunk' ? 'bg-card text-muted' : ''
    const lineNumber = line.newNumber ?? line.oldNumber
    const here = comments.filter(comment => comment.path === selected.path && comment.line === lineNumber && line.kind !== 'hunk')
    const editing = commentingOn?.path === selected.path && commentingOn.line === lineNumber && line.kind !== 'hunk'
    return (
      <div key={index}>
        <div role="row" className={cn('group flex', tint)}>
          <span className="w-10 shrink-0 pr-2 text-right text-[#5e5e69]">{line.oldNumber ?? ''}</span>
          <span className="w-10 shrink-0 pr-2 text-right text-[#5e5e69]">{line.newNumber ?? ''}</span>
          <span className="relative w-5 shrink-0 text-center">
            {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ''}
            {line.kind !== 'hunk' && lineNumber !== null && (
              <button type="button" aria-label={t('commentOnLine', { line: lineNumber })} onClick={() => setCommentingOn({ path: selected.path, line: lineNumber })} className="absolute inset-0 hidden items-center justify-center bg-info text-canvas group-hover:flex"><MessageSquarePlusIcon size={11} /></button>
            )}
          </span>
          <span className="whitespace-pre">{line.text}</span>
        </div>
        {here.map(comment => (
          <div key={`${comment.line}-${comment.text}`} className="mx-4 my-1.5 ml-24 rounded-md border border-[#3b4a8a] bg-[#141a33] px-3 py-2 font-sans text-[13px] text-[#d6dcf5]">
            <p className="text-[11.5px] font-semibold text-[#a9bcff]">{t('yourComment', { line: comment.line })}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{comment.text}</p>
          </div>
        ))}
        {editing && (
          <div className="mx-4 my-1.5 ml-24 rounded-lg border border-line bg-card p-2.5 font-sans text-[13px] text-ink">
            <textarea autoFocus value={draft} onChange={event => setDraft(event.target.value)} rows={2} aria-label={t('commentField')} placeholder={t('commentPlaceholder')} className="w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-2 outline-none" />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setCommentingOn(null); setDraft('') }}>{t('cancel', { ns: 'common' })}</Button>
              <Button onClick={addComment}>{t('addToBatch')}</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex w-72 shrink-0 flex-col border-r border-line bg-side py-2">
          <label className="mx-2.5 mb-2 flex h-7 items-center gap-2 rounded-md border border-line px-2 text-muted">
            <SearchIcon size={13} />
            <input value={filter} onChange={event => setFilter(event.target.value)} aria-label={t('filter')} placeholder={t('filter')} className="min-w-0 flex-1 bg-transparent text-ink outline-none" />
          </label>
          <div className="flex-1 overflow-y-auto">
            <h3 className="px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{t('unreviewed', { count: unreviewed.length })}</h3>
            <ul aria-label={t('filesLabel')}>{unreviewed.map(file => fileRow(file.path, file.added, file.removed))}</ul>
            {reviewed.length > 0 && <h3 className="px-3.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{t('reviewed', { count: reviewed.length })}</h3>}
            <ul>{reviewed.map(file => fileRow(file.path, file.added, file.removed))}</ul>
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-auto">
          {diff.data?.wasTruncated && <p role="status" className="border-b border-line bg-[#201b0e] px-4 py-2 text-[12.5px] text-warn">{t('truncated')}</p>}
          <div className="flex h-11 items-center gap-3 border-b border-line px-4">
            <span className="flex-1 truncate font-mono">{selected.path}</span>
            <span className="flex overflow-hidden rounded-md border border-line text-[12px]" role="group" aria-label={t('layout')}>
              <button type="button" aria-pressed={!split} onClick={() => setSplit(false)} className={cn('px-2.5 py-1', split ? 'text-muted' : 'bg-hover')}>{t('unified')}</button>
              <button type="button" aria-pressed={split} onClick={() => setSplit(true)} className={cn('px-2.5 py-1', split ? 'bg-hover' : 'text-muted')}>{t('split')}</button>
            </span>
            <label className="flex h-7 cursor-pointer items-center gap-2 rounded-md border border-line px-2.5">
              <input type="checkbox" checked={marks.isViewed(workspaceIdentifier, selected.path)} onChange={() => marks.toggleViewed(workspaceIdentifier, selected.path)} className="size-3.5 accent-white" />
              {t('viewed')}
            </label>
          </div>
          {selected.isBinary ? (
            <p className="p-4 text-muted">{t('binary')}</p>
          ) : (
            <div role="table" aria-label={t('diffOf', { path: selected.path })} className="py-1 font-mono text-[12.5px] leading-5.5">
              {split
                ? splitRows.map((row, index) =>
                    row.kind === 'hunk' ? (
                      <div key={index} role="row" className="bg-card px-3 text-muted">{row.left?.text}</div>
                    ) : (
                      <div key={index} role="row" className="grid grid-cols-2">
                        <SplitCell line={row.left} side="left" />
                        <SplitCell line={row.right} side="right" />
                      </div>
                    ),
                  )
                : selected.lines.map(unifiedRow)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-side px-4 py-2.5">
        <span className="text-muted">{t('progress', { seen: marks.viewedCount(workspaceIdentifier), total: files.length })}</span>
        <span className="h-1 w-30 rounded bg-hover"><span className="block h-1 rounded bg-ink" style={{ width: `${(marks.viewedCount(workspaceIdentifier) / files.length) * 100}%` }} /></span>
        <span className="flex-1" />
        {sendFollowUp.isError && <span role="alert" className="text-[12.5px] text-danger">{failureText(sendFollowUp.error)}</span>}
        <Badge><MessageSquarePlusIcon size={12} />{t('batch', { count: comments.length })}</Badge>
        <Button variant="outline" icon={<SendIcon size={13} />} disabled={comments.length === 0 || working} loading={sendFollowUp.isPending} onClick={() => void sendToAgent()}>{t('sendToAgent')}</Button>
        <Button icon={<CheckIcon size={13} />} disabled={working} onClick={() => publish.show({ workspaces: workspaceIdentifier })}>{t('approve')}</Button>
      </div>
    </div>
  )
}

function SplitCell({ line, side }: { line: DiffLine | null; side: 'left' | 'right' }) {
  const number = side === 'left' ? line?.oldNumber : line?.newNumber
  return (
    <div className={cn('flex min-w-0 border-r border-line', line?.kind === 'add' && ADDED, line?.kind === 'remove' && REMOVED)}>
      <span className="w-10 shrink-0 pr-2 text-right text-[#5e5e69]">{number ?? ''}</span>
      <span className="whitespace-pre">{line?.text ?? ''}</span>
    </div>
  )
}
