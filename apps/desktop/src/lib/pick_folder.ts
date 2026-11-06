import { insideTauri } from '@/lib/tauri'

/** Opens the system's folder chooser. Returns null when cancelled or outside the app window. */
export async function pickFolder(title: string): Promise<string | null> {
  if (!insideTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const chosen = await open({ directory: true, multiple: false, title })
  return typeof chosen === 'string' ? chosen : null
}
