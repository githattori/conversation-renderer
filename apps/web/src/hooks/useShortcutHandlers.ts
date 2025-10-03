import { useEffect } from 'react'
import { useAppStore } from '../state/store'

export const useShortcutHandlers = () => {
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const triggerSave = useAppStore((state) => state.triggerSave)
  const toggleCommandPalette = useAppStore((state) => state.toggleCommandPalette)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (!isMeta) return
      const lower = event.key.toLowerCase()
      if (lower === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
      if (lower === 'y') {
        event.preventDefault()
        redo()
      }
      if (lower === 's') {
        event.preventDefault()
        void triggerSave()
      }
      if (lower === 'k') {
        event.preventDefault()
        toggleCommandPalette(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [redo, toggleCommandPalette, triggerSave, undo])
}
