import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff, toSplitRows } from './unified_diff'

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 111..222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -10,3 +10,4 @@ function a()',
  ' keep',
  '-old',
  '+new',
  '+extra',
  ' tail',
  'diff --git a/logo.png b/logo.png',
  'Binary files a/logo.png and b/logo.png differ',
].join('\n')

describe('parseUnifiedDiff', () => {
  it('splits files, counts changes and numbers lines on both sides', () => {
    const [file] = parseUnifiedDiff(DIFF)

    expect(file).toMatchObject({ path: 'src/a.ts', added: 2, removed: 1, isBinary: false })
    expect(file!.lines.map(line => [line.kind, line.oldNumber, line.newNumber, line.text])).toEqual([
      ['hunk', null, null, '@@ -10,3 +10,4 @@ function a()'],
      ['context', 10, 10, 'keep'],
      ['remove', 11, null, 'old'],
      ['add', null, 11, 'new'],
      ['add', null, 12, 'extra'],
      ['context', 12, 13, 'tail'],
    ])
  })

  it('marks a binary file instead of inventing lines', () => {
    expect(parseUnifiedDiff(DIFF)[1]).toMatchObject({ path: 'logo.png', isBinary: true, lines: [] })
  })

  it('returns nothing for an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([])
  })
})

describe('file status', () => {
  it('tells new, deleted and changed files apart', () => {
    const files = parseUnifiedDiff(['diff --git a/n.ts b/n.ts', 'new file mode 100644', '@@ -0,0 +1 @@', '+x', 'diff --git a/d.ts b/d.ts', 'deleted file mode 100644', '@@ -1 +0,0 @@', '-x', 'diff --git a/m.ts b/m.ts', '@@ -1 +1 @@', '-a', '+b'].join('\n'))

    expect(files.map(file => file.status)).toEqual(['added', 'deleted', 'modified'])
  })
})

describe('toSplitRows', () => {
  it('faces removed lines with the added ones and leaves the spare side empty', () => {
    const rows = toSplitRows(parseUnifiedDiff(DIFF)[0]!.lines)

    expect(rows.map(row => [row.kind, row.left?.text ?? null, row.right?.text ?? null])).toEqual([
      ['hunk', '@@ -10,3 +10,4 @@ function a()', '@@ -10,3 +10,4 @@ function a()'],
      ['pair', 'keep', 'keep'],
      ['pair', 'old', 'new'],
      ['pair', null, 'extra'],
      ['pair', 'tail', 'tail'],
    ])
  })
})
