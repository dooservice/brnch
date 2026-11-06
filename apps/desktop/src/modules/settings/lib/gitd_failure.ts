export type GitdFailureKind = 'access_denied' | 'not_running' | 'other'

const ACCESS_DENIED = /os error (10013|13)\b|permission denied/i
const NOT_RUNNING = /os error (10050|10051|10061|2|111)\b|no such file|refused|not found/i

/** What a failure to reach gitd means for the person, read from the operating system's error. */
export function classifyGitdFailure(message: string | null): GitdFailureKind {
  if (message === null) return 'other'
  if (ACCESS_DENIED.test(message)) return 'access_denied'
  if (NOT_RUNNING.test(message)) return 'not_running'
  return 'other'
}
