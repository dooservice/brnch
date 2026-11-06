import { BotIcon, CheckIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon, FileTextIcon, InfoIcon, Loader2Icon, PencilIcon, SearchIcon, TerminalIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { describeTool } from '../lib/describe_tool'
import { buildTimelineItems } from '../lib/timeline_items'
import type { TimelineItem } from '../lib/timeline_items'
import type { TimelineEntry } from '../types/workspace.types'

/** What the agent of a workspace has done so far, oldest first. */
export default function AgentTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  const { t } = useTranslation('workspaces')
  const items = buildTimelineItems(entries)
  if (items.length === 0) {
    return <p className="text-center text-muted">{t('timeline.empty')}</p>
  }
  return (
    <ol aria-label={t('timeline.label')} className="mx-auto flex w-full max-w-175 flex-col gap-3">
      {items.map(item => (
        <li key={item.key}>
          <TimelineRow item={item} />
        </li>
      ))}
    </ol>
  )
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const { t } = useTranslation('workspaces')
  switch (item.type) {
    case 'session':
      return <p className="text-[12px] text-muted">{t('timeline.session', { model: item.modelName })}</p>
    case 'user':
      return <div className="ml-auto max-w-140 rounded-xl bg-hover px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap">{item.text}</div>
    case 'message':
      return (
        <div className="flex gap-3">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-md border border-line"><BotIcon size={14} /></span>
          <p className="pt-0.5 leading-relaxed whitespace-pre-wrap">{item.text}</p>
        </div>
      )
    case 'tool': {
      const { verb, target } = describeTool(item.name, item.summary)
      return (
        <div className={cn('ml-9.5 flex items-center gap-2.5 rounded-md border bg-card px-2.5 py-1.5 text-[12.5px]', item.status === 'running' ? 'border-[#4a3a14]' : 'border-line')}>
          {verb === 'run' ? <TerminalIcon size={14} className="text-muted" /> : verb === 'read' ? <FileTextIcon size={14} className="text-muted" /> : verb === 'search' ? <SearchIcon size={14} className="text-muted" /> : <PencilIcon size={14} className="text-muted" />}
          <span className="text-muted">{verb === 'other' ? item.name : t(`timeline.verbs.${verb}`)}</span>
          <span className="flex-1 truncate font-mono">{target}</span>
          {item.status === 'running' && <Loader2Icon size={14} role="status" aria-label={t('timeline.toolRunning')} className="animate-spin text-warn" />}
          {item.status === 'done' && <CheckIcon size={14} aria-label={t('timeline.toolDone')} className="text-ok" />}
          {item.status === 'failed' && <XIcon size={14} aria-label={t('timeline.toolFailed')} className="text-danger" />}
        </div>
      )
    }
    case 'unparsed':
      return (
        <div className="ml-9.5 flex items-start gap-2.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-[12.5px]">
          <InfoIcon size={14} className="mt-0.5 shrink-0 text-muted" />
          <span className="text-muted"><span className="mr-1.5">{t('timeline.unparsed')}:</span><span className="font-mono break-all">{item.rawLine}</span></span>
        </div>
      )
    case 'finished':
      return (
        <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3', item.succeeded ? 'border-[#1d4a33] bg-[#0e1c15]' : 'border-[#5a2326] bg-[#1c0f10]')}>
          {item.succeeded ? <CircleCheckIcon size={16} className="mt-0.5 text-ok" /> : <CircleXIcon size={16} className="mt-0.5 text-danger" />}
          <div className="flex-1">
            <p className="font-medium">{item.succeeded ? t('timeline.finished') : t('timeline.notFinished')}</p>
            {item.summary !== '' && <p className="mt-0.5 whitespace-pre-wrap text-muted">{item.summary}</p>}
            <p className="mt-1 font-mono text-[11.5px] text-muted">
              {item.seconds !== null && `${item.seconds.toFixed(1)} s`}
              {item.seconds !== null && item.cost !== null && ' · '}
              {item.cost !== null && `${item.cost.toFixed(2)} $`}
            </p>
          </div>
          {!item.succeeded && <CircleAlertIcon size={14} className="mt-0.5 text-danger" />}
        </div>
      )
  }
}
