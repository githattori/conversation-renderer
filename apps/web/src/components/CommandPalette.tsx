import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../state/store'

interface PaletteItem {
  id: string
  label: string
  description: string
  type: 'preset' | 'command'
  command?: string
}

const staticCommands: PaletteItem[] = [
  { id: 'cmd-flowchart', label: '/diagram flowchart', description: 'Switch to Mermaid flowchart mode', type: 'command', command: '/diagram flowchart' },
  { id: 'cmd-sequence', label: '/diagram sequence', description: 'Switch to Mermaid sequence mode', type: 'command', command: '/diagram sequence' },
  { id: 'cmd-mindmap', label: '/diagram mindmap', description: 'Switch to Markmap mindmap mode', type: 'command', command: '/diagram mindmap' },
]

export const CommandPalette = () => {
  const open = useAppStore((state) => state.commandPaletteOpen)
  const toggle = useAppStore((state) => state.toggleCommandPalette)
  const execute = useAppStore((state) => state.executeCommand)
  const rolePresets = useAppStore((state) => state.rolePresets)
  const setRolePreset = useAppStore((state) => state.setRolePreset)

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!open) return
      if (event.key === 'Escape') {
        event.preventDefault()
        toggle(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, toggle])

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const presetItems: PaletteItem[] = rolePresets.map((preset) => ({
      id: `preset-${preset.id}`,
      label: preset.label,
      description: preset.description,
      type: 'preset',
    }))
    return [...presetItems, ...staticCommands]
  }, [rolePresets])

  const filtered = useMemo(() => {
    if (!query) return paletteItems
    const lower = query.toLowerCase()
    return paletteItems.filter((item) => item.label.toLowerCase().includes(lower) || item.description.toLowerCase().includes(lower))
  }, [paletteItems, query])

  const handleSelect = async (item: PaletteItem) => {
    if (item.type === 'preset') {
      const preset = rolePresets.find((preset) => `preset-${preset.id}` === item.id)
      if (preset) {
        setRolePreset(preset)
      }
    } else if (item.command) {
      await execute(item.command)
    }
    toggle(false)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const [first] = filtered
    if (first) {
      void handleSelect(first)
    }
  }

  if (!open) return null

  return (
    <div className="palette-backdrop" role="dialog" aria-modal="true" aria-label="Command palette">
      <form className="command-palette" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands or roles"
        />
        <ul>
          {filtered.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => handleSelect(item)}>
                <span className="label">{item.label}</span>
                <span className="description">{item.description}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="empty-state">No matches</li>}
        </ul>
      </form>
    </div>
  )
}
