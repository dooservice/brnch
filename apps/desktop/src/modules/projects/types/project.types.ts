export interface Project {
  identifier: string
  name: string
  repositoryUrl: string
}

/** What a project had open when it was left: the page the person was on. */
export interface ProjectLayout {
  path: string
}
