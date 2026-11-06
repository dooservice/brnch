export type ToolVerb = 'read' | 'create' | 'edit' | 'run' | 'search' | 'other'

const VERBS: Record<string, ToolVerb> = {
  Read: 'read',
  Write: 'create',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Bash: 'run',
  Grep: 'search',
  Glob: 'search',
}

/** What the tool did and to what, from the name and the start of its input as the agent sent it. */
export function describeTool(name: string, inputSummary: string): { verb: ToolVerb; target: string } {
  const verb = VERBS[name] ?? 'other'
  const field = verb === 'run' ? 'command' : verb === 'search' ? 'pattern' : 'file_path'
  const match = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(inputSummary)
  const target = match?.[1]?.replace(/\\(.)/g, '$1') ?? inputSummary
  return { verb, target }
}
