import { RUN_LABEL_WORDS } from '@/lib/constants'

/** The run's name, which becomes its branch, comes from the first words of the task. */
export function deriveRunLabel(prompt: string): string {
  return prompt.trim().split(/\s+/).slice(0, RUN_LABEL_WORDS).join(' ')
}
