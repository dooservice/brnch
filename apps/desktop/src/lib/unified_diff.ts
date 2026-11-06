export type DiffLineKind = 'hunk' | 'add' | 'remove' | 'context'

export interface DiffLine {
  kind: DiffLineKind
  oldNumber: number | null
  newNumber: number | null
  text: string
}

export interface DiffFile {
  path: string
  added: number
  removed: number
  isBinary: boolean
  lines: DiffLine[]
}

export interface SplitRow {
  kind: 'hunk' | 'pair'
  left: DiffLine | null
  right: DiffLine | null
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Reads the unified diff gitd returns into files and numbered lines. */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  let oldNumber = 0
  let newNumber = 0
  let insideHunk = false

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current) files.push(current)
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
      current = { path: match?.[2] ?? line.slice(11), added: 0, removed: 0, isBinary: false, lines: [] }
      insideHunk = false
      continue
    }
    if (!current) continue
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      current.isBinary = true
      continue
    }
    const hunk = HUNK_HEADER.exec(line)
    if (hunk) {
      oldNumber = Number(hunk[1])
      newNumber = Number(hunk[2])
      insideHunk = true
      current.lines.push({ kind: 'hunk', oldNumber: null, newNumber: null, text: line })
      continue
    }
    if (!insideHunk) continue
    if (line.startsWith('+')) {
      current.added += 1
      current.lines.push({ kind: 'add', oldNumber: null, newNumber, text: line.slice(1) })
      newNumber += 1
    } else if (line.startsWith('-')) {
      current.removed += 1
      current.lines.push({ kind: 'remove', oldNumber, newNumber: null, text: line.slice(1) })
      oldNumber += 1
    } else if (line.startsWith(' ')) {
      current.lines.push({ kind: 'context', oldNumber, newNumber, text: line.slice(1) })
      oldNumber += 1
      newNumber += 1
    }
  }
  if (current) files.push(current)
  return files
}

/** Lines for the side-by-side view: removed lines on the left face the added ones on the right. */
export function toSplitRows(lines: readonly DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let removed: DiffLine[] = []
  let added: DiffLine[] = []
  const flush = () => {
    const height = Math.max(removed.length, added.length)
    for (let index = 0; index < height; index += 1) {
      rows.push({ kind: 'pair', left: removed[index] ?? null, right: added[index] ?? null })
    }
    removed = []
    added = []
  }
  for (const line of lines) {
    if (line.kind === 'remove') removed.push(line)
    else if (line.kind === 'add') added.push(line)
    else {
      flush()
      rows.push(line.kind === 'hunk' ? { kind: 'hunk', left: line, right: line } : { kind: 'pair', left: line, right: line })
    }
  }
  flush()
  return rows
}
