import type { Project } from '@/modules/projects'
import type { Workspace, RunNotice } from '@/modules/workspaces'
import type { AgentInstallation, GitdStatus, SandboxStatus } from '@/modules/settings'

interface WorkspaceSeed {
  title?: string
  branchName?: string
  status?: Workspace['status']
  runIdentifier?: string | null
  costInDollars?: number | null
}

/** Plays the Rust side in memory: every command a screen can call, with data a test controls. */
export class FakeDesktop {
  projects: Project[] = []
  active: string | null = null
  workspaces = new Map<string, Workspace[]>()
  layouts = new Map<string, string>()
  events = new Map<string, RunNotice[]>()
  diffs = new Map<string, { unifiedDiff: string; wasTruncated: boolean }>()
  conflicts: Array<{ firstWorkspaceIdentifier: string; secondWorkspaceIdentifier: string; clashingPaths: string[] }> = []
  sandbox: SandboxStatus = { available: true, mechanism: 'bubblewrap', reason: null }
  agents: AgentInstallation[] = [{ kind: 'claude_code', installed: true, version: '2.1.0' }]
  gitd: GitdStatus = { connected: true, message: null }
  statistics: Array<{ workspaceIdentifier: string; files: number; added: number; removed: number }> = []
  files = new Map<string, string>()
  terminalBacklog = ''
  terminalFailure: string | null = null
  publishFailure: string | null = null
  readonly calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = []
  private counter = 0
  private liveListener: ((notice: RunNotice) => void) | null = null

  reset(): void {
    Object.assign(this, new FakeDesktop())
  }

  addProject(name: string): Project {
    this.counter += 1
    const project = { identifier: `project-${this.counter}`, name, repositoryUrl: `https://example.com/${name}`, baseBranch: null, workspacesDirectory: null }
    this.projects.push(project)
    this.workspaces.set(project.identifier, [])
    return project
  }

  addWorkspace(project: Project, seed: WorkspaceSeed = {}): Workspace {
    this.counter += 1
    const identifier = `workspace-${this.counter}`
    const workspace: Workspace = {
      identifier,
      directory: `/work/${identifier}`,
      branchName: seed.branchName ?? `agents/${identifier}`,
      title: seed.title ?? `Task ${identifier}`,
      agentLabel: 'Claude Code',
      runIdentifier: seed.runIdentifier === undefined ? `run-${identifier}` : seed.runIdentifier,
      status: seed.status ?? 'idle',
      startedAtMilliseconds: null,
      costInDollars: seed.costInDollars ?? null,
      durationInMilliseconds: null,
      totalTokens: null,
      permissionMode: 'edit_files',
      baseCommit: null,
    }
    this.workspaces.set(project.identifier, [...(this.workspaces.get(project.identifier) ?? []), workspace])
    return workspace
  }

  emitLive(notice: RunNotice): void {
    this.liveListener?.(notice)
  }

  called(name: string): Array<Record<string, unknown> | undefined> {
    return this.calls.filter(call => call.name === name).map(call => call.args)
  }

  async handle(name: string, args?: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ name, args })
    switch (name) {
      case 'list_projects':
        return [...this.projects]
      case 'active_project_identifier':
        return this.active
      case 'add_project': {
        const project = this.addProject(String(args?.name))
        project.baseBranch = (args?.baseBranch as string | null) ?? null
        project.workspacesDirectory = (args?.workspacesDirectory as string | null) ?? null
        project.repositoryUrl = String(args?.repositoryUrl)
        return project
      }
      case 'inspect_repository':
        return String(args?.location).includes('unreachable')
          ? { accessible: false, defaultBranch: null, branches: [], message: 'repository not found' }
          : { accessible: true, defaultBranch: 'main', branches: ['develop', 'main'], message: null }
      case 'workspace_statistics':
        return this.statistics
      case 'activate_project':
        this.active = String(args?.identifier)
        return null
      case 'list_workspaces':
        return [...(this.workspaces.get(String(args?.projectIdentifier)) ?? [])]
      case 'load_view':
        return this.layouts.get(String(args?.projectIdentifier)) ?? null
      case 'save_view':
        this.layouts.set(String(args?.projectIdentifier), String(args?.layoutJson))
        return null
      case 'list_workspace_events':
        return this.events.get(String(args?.workspaceIdentifier)) ?? []
      case 'read_workspace_diff':
        return this.diffs.get(String(args?.workspaceIdentifier)) ?? { unifiedDiff: '', wasTruncated: false }
      case 'find_project_conflicts':
        return this.conflicts
      case 'publish_workspaces':
        return (args?.workspaceIdentifiers as string[]).map(workspaceIdentifier => ({
          workspaceIdentifier,
          branchName: this.publishFailure === null ? `agents/${workspaceIdentifier}` : null,
          failure: this.publishFailure,
        }))
      case 'start_run': {
        const request = args?.request as { projectIdentifier: string; runLabel: string; copies: number }
        const project = this.projects.find(candidate => candidate.identifier === request.projectIdentifier)!
        const runIdentifier = `run-${++this.counter}`
        const started: string[] = []
        for (let copy = 1; copy <= request.copies; copy += 1) {
          started.push(this.addWorkspace(project, { title: request.runLabel, branchName: `agents/${request.runLabel}-${copy}`, status: 'running', runIdentifier }).identifier)
        }
        return started
      }
      case 'stop_run':
      case 'send_follow_up':
        return name === 'stop_run' ? true : null
      case 'list_workspace_files': {
        const folder = String(args?.relativePath)
        const prefix = folder === '' ? '' : `${folder}/`
        const names = new Map<string, boolean>()
        for (const path of this.files.keys()) {
          if (!path.startsWith(prefix)) continue
          const rest = path.slice(prefix.length)
          const [first, ...others] = rest.split('/')
          if (first !== undefined) names.set(first, others.length > 0 || names.get(first) === true)
        }
        return [...names.entries()].sort(([a, aDir], [b, bDir]) => Number(bDir) - Number(aDir) || a.localeCompare(b)).map(([name, isDirectory]) => ({ name, relativePath: `${prefix}${name}`, isDirectory }))
      }
      case 'read_workspace_file': {
        const content = this.files.get(String(args?.relativePath))
        if (content === undefined) throw 'no such file'
        return { content, isBinary: content === '\u0000binary', isTooLarge: false }
      }
      case 'write_workspace_file':
        this.files.set(String(args?.relativePath), String(args?.content))
        return null
      case 'find_workspace_files':
        return [...this.files.keys()].filter(path => path.toLowerCase().includes(String(args?.query).toLowerCase()))
      case 'find_workspace_text':
        return [...this.files.entries()].flatMap(([path, content]) => content.split('\n').flatMap((text, index) => (text.toLowerCase().includes(String(args?.query).toLowerCase()) ? [{ relativePath: path, line: index + 1, text }] : [])))
      case 'open_terminal':
        if (this.terminalFailure !== null) throw this.terminalFailure
        return { terminalIdentifier: 'terminal-1', backlogBase64: this.terminalBacklog }
      case 'write_terminal':
      case 'resize_terminal':
        return null
      case 'sandbox_status':
        return this.sandbox
      case 'detect_agents':
        return this.agents
      case 'gitd_status':
        return this.gitd
      default:
        throw new Error(`The fake desktop does not know the command ${name}`)
    }
  }

  subscribe(listener: (notice: RunNotice) => void): () => void {
    this.liveListener = listener
    return () => {
      this.liveListener = null
    }
  }
}

export const desktop = new FakeDesktop()
