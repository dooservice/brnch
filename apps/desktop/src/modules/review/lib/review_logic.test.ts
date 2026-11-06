import { describe, expect, it } from 'vitest'
import { ReviewMarks } from './review_marks'
import { buildReviewPrompt } from './review_prompt'

describe('buildReviewPrompt', () => {
  it('lists every comment with its file and line', () => {
    const prompt = buildReviewPrompt([{ path: 'src/a.ts', line: 7, text: 'Move it right' }, { path: 'src/b.ts', line: 2, text: 'Rename' }])

    expect(prompt).toBe(['Please address these review comments on your changes:', '- src/a.ts:7 — Move it right', '- src/b.ts:2 — Rename'].join('\n'))
  })
})

describe('ReviewMarks', () => {
  it('remembers viewed files and comments per workspace and tells listeners', () => {
    const marks = new ReviewMarks()
    let announcements = 0
    marks.subscribe(() => (announcements += 1))

    marks.toggleViewed('w1', 'a.ts')
    marks.addComment('w1', { path: 'a.ts', line: 1, text: 'x' })

    expect(marks.isViewed('w1', 'a.ts')).toBe(true)
    expect(marks.viewedCount('w2')).toBe(0)
    expect(marks.commentsOf('w1')).toHaveLength(1)
    marks.toggleViewed('w1', 'a.ts')
    expect(marks.viewedCount('w1')).toBe(0)
    marks.clearComments('w1')
    expect(marks.commentsOf('w1')).toHaveLength(0)
    expect(announcements).toBe(4)
  })
})
