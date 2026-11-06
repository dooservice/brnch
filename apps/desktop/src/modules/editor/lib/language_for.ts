import type { Extension } from '@codemirror/state'

type Loader = () => Promise<Extension>

const LANGUAGES: Record<string, { name: string; load: Loader }> = {
  ts: { name: 'TypeScript', load: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }) },
  tsx: { name: 'TypeScript React', load: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx: true }) },
  js: { name: 'JavaScript', load: async () => (await import('@codemirror/lang-javascript')).javascript() },
  jsx: { name: 'JavaScript React', load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }) },
  json: { name: 'JSON', load: async () => (await import('@codemirror/lang-json')).json() },
  md: { name: 'Markdown', load: async () => (await import('@codemirror/lang-markdown')).markdown() },
  css: { name: 'CSS', load: async () => (await import('@codemirror/lang-css')).css() },
  html: { name: 'HTML', load: async () => (await import('@codemirror/lang-html')).html() },
  rs: { name: 'Rust', load: async () => (await import('@codemirror/lang-rust')).rust() },
  py: { name: 'Python', load: async () => (await import('@codemirror/lang-python')).python() },
}

function extensionOf(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

/** The name shown in the status bar for a file, or plain text when there is no highlighting for it. */
export function languageName(path: string): string | null {
  return LANGUAGES[extensionOf(path)]?.name ?? null
}

export async function loadLanguage(path: string): Promise<Extension | null> {
  return (await LANGUAGES[extensionOf(path)]?.load()) ?? null
}
