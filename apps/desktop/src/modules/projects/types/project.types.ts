export interface Project {
  identifier: string
  name: string
  repositoryUrl: string
  baseBranch: string | null
  workspacesDirectory: string | null
}

/** What a project had open when it was left: the page the person was on. */
export interface ProjectLayout {
  path: string
}

export interface RepositoryInspection {
  accessible: boolean
  defaultBranch: string | null
  branches: string[]
  message: string | null
}
