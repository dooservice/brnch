export interface FileEntry {
  name: string
  relativePath: string
  isDirectory: boolean
}

export interface FileContent {
  content: string
  isBinary: boolean
  isTooLarge: boolean
}

export interface TextMatch {
  relativePath: string
  line: number
  text: string
}

/** What a workspace had open in its editor. */
export interface OpenFiles {
  paths: string[]
  active: string | null
}
