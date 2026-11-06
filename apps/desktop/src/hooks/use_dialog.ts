import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type DialogName = 'palette' | 'add-project' | 'new-run' | 'publish' | 'about'

const PARAMETER = 'dialog'

/**
 * Whether one of the app's dialogs is open. The open dialog lives in the address, so any module
 * can open any dialog without importing it, and going back closes it.
 */
export function useDialog(name: DialogName) {
  const [params, setParams] = useSearchParams()
  const open = params.get(PARAMETER) === name

  const show = useCallback(
    (extra: Record<string, string> = {}) => {
      setParams(current => {
        const next = new URLSearchParams(current)
        next.set(PARAMETER, name)
        Object.entries(extra).forEach(([key, value]) => next.set(key, value))
        return next
      })
    },
    [name, setParams],
  )

  const hide = useCallback(() => {
    setParams(current => {
      const next = new URLSearchParams(current)
      next.delete(PARAMETER)
      return next
    })
  }, [setParams])

  const toggle = useCallback(() => (open ? hide() : show()), [open, hide, show])

  return { open, show, hide, toggle, get: (key: string) => params.get(key) }
}
