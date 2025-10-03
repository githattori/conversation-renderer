import { FormEvent, useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import clsx from 'clsx'

const roleColors: Record<string, string> = {
  user: 'var(--accent)',
  assistant: '#5b5f97',
  system: '#8e6c88',
}

export const ChatPanel = () => {
  const [input, setInput] = useState('')
  const chat = useAppStore((state) => state.chat)
  const addChatMessage = useAppStore((state) => state.addChatMessage)
  const executeCommand = useAppStore((state) => state.executeCommand)
  const appendHistory = useAppStore((state) => state.appendHistory)
  const toggleCommandPalette = useAppStore((state) => state.toggleCommandPalette)
  const activeRole = useAppStore((state) => state.activeRole)

  const sortedMessages = useMemo(() => chat.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [chat])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    if (trimmed.startsWith('/')) {
      await executeCommand(trimmed)
    } else {
      addChatMessage({ role: 'user', content: trimmed })
      appendHistory('User message captured')
    }
    setInput('')
  }

  return (
    <section className="pane chat-pane">
      <header className="pane-header">
        <div>
          <h2>Session Chat</h2>
          {activeRole ? <p className="subtle">Role preset: {activeRole.label}</p> : <p className="subtle">No role preset selected</p>}
        </div>
        <button className="ghost" onClick={() => toggleCommandPalette(true)} type="button">
          ⌘K Command Palette
        </button>
      </header>
      <div className="chat-history" aria-live="polite">
        {sortedMessages.length === 0 ? (
          <p className="empty-state">Use the command palette or send a prompt to begin.</p>
        ) : (
          sortedMessages.map((message) => (
            <article key={message.id} className={clsx('chat-message', message.role)}>
              <header style={{ color: roleColors[message.role] }}>{message.role.toUpperCase()}</header>
              <p>{message.content}</p>
              <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
            </article>
          ))
        )}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type messages or commands. Try /diagram mindmap"
          rows={4}
        />
        <div className="chat-actions">
          <span className="hint">Enter to send · Shift+Enter for newline</span>
          <div>
            <button className="ghost" type="button" onClick={() => toggleCommandPalette(true)}>
              Presets & Commands
            </button>
            <button type="submit" className="primary">
              Send
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
