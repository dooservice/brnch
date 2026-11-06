import { useSyncExternalStore } from 'react'
import type { ReviewComment } from '../types/review.types'

type Listener = () => void

/**
 * What a reviewer has marked while reading a diff: files already seen and comments waiting to be
 * sent to the agent. It lives in memory for the length of the session.
 */
export class ReviewMarks {
  private readonly viewed = new Map<string, Set<string>>()
  private readonly comments = new Map<string, ReviewComment[]>()
  private readonly listeners = new Set<Listener>()
  private version = 0

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  isViewed(workspaceIdentifier: string, path: string): boolean {
    return this.viewed.get(workspaceIdentifier)?.has(path) ?? false
  }

  viewedCount(workspaceIdentifier: string): number {
    return this.viewed.get(workspaceIdentifier)?.size ?? 0
  }

  toggleViewed(workspaceIdentifier: string, path: string): void {
    const set = new Set(this.viewed.get(workspaceIdentifier) ?? [])
    if (!set.delete(path)) set.add(path)
    this.viewed.set(workspaceIdentifier, set)
    this.announce()
  }

  commentsOf(workspaceIdentifier: string): readonly ReviewComment[] {
    return this.comments.get(workspaceIdentifier) ?? []
  }

  addComment(workspaceIdentifier: string, comment: ReviewComment): void {
    this.comments.set(workspaceIdentifier, [...this.commentsOf(workspaceIdentifier), comment])
    this.announce()
  }

  clearComments(workspaceIdentifier: string): void {
    this.comments.delete(workspaceIdentifier)
    this.announce()
  }

  /** Forgets everything; the tests start each case from a clean slate. */
  reset(): void {
    this.viewed.clear()
    this.comments.clear()
    this.announce()
  }

  private announce(): void {
    this.version += 1
    this.listeners.forEach(listener => listener())
  }
}

export const reviewMarks = new ReviewMarks()

/** Repaints the component whenever what the reviewer marked changes. */
export function useReviewMarks(marks: ReviewMarks = reviewMarks): ReviewMarks {
  useSyncExternalStore(marks.subscribe, marks.getVersion)
  return marks
}
