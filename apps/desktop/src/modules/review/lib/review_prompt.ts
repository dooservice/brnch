import type { ReviewComment } from '../types/review.types'

/** Turns the batch of review comments into one message the agent can act on. */
export function buildReviewPrompt(comments: readonly ReviewComment[]): string {
  const lines = comments.map(comment => `- ${comment.path}:${comment.line} — ${comment.text}`)
  return ['Please address these review comments on your changes:', ...lines].join('\n')
}
