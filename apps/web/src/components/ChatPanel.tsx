import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../state/store'
import clsx from 'clsx'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

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
  const voiceDraftRef = useRef('')

  const submitMessage = useCallback(
    async (rawMessage: string) => {
      const trimmed = rawMessage.trim()
      if (!trimmed) {
        return false
      }

      if (trimmed.startsWith('/')) {
        await executeCommand(trimmed)
      } else {
        addChatMessage({ role: 'user', content: trimmed })
        appendHistory('User message captured')
      }

      return true
    },
    [addChatMessage, appendHistory, executeCommand],
  )

  const handleVoiceResult = useCallback((transcript: string) => {
    const sanitized = transcript.trim()
    if (!sanitized) {
      return
    }

    voiceDraftRef.current = voiceDraftRef.current
      ? `${voiceDraftRef.current}${voiceDraftRef.current.endsWith(' ') ? '' : ' '}${sanitized}`
      : sanitized
  }, [])

  const { supported: speechSupported, listening: isListening, start: startListening, stop: stopListening } =
    useSpeechRecognition({
      onResult: handleVoiceResult,
    })

  useEffect(() => {
    if (isListening) {
      return
    }

    const draft = voiceDraftRef.current.trim()
    if (!draft) {
      voiceDraftRef.current = ''
      return
    }

    voiceDraftRef.current = ''
    void submitMessage(draft)
  }, [isListening, submitMessage])

  const sortedMessages = useMemo(() => chat.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [chat])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const didSubmit = await submitMessage(input)
    if (!didSubmit) {
      return
    }

    if (isListening) {
      stopListening()
    }

    setInput('')
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return

    if (event.metaKey || (!event.shiftKey && !event.ctrlKey && !event.altKey)) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const hintMessage = speechSupported
    ? isListening
      ? 'Listening… tap the mic button to stop'
      : 'Voice messages send automatically · Enter or ⌘Enter to send · Shift+Enter for newline'
    : 'Enter or ⌘Enter to send · Shift+Enter for newline'

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
          onKeyDown={handleTextareaKeyDown}
          placeholder="Type messages or commands. Try /diagram mindmap"
          rows={4}
        />
        <div className="chat-actions">
          <span className="hint">{hintMessage}</span>
          <div className="chat-actions-buttons">
            <button
              className={clsx('ghost', { active: isListening })}
              type="button"
              onClick={() => (isListening ? stopListening() : startListening())}
              disabled={!speechSupported}
              aria-pressed={isListening}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={speechSupported ? (isListening ? '音声入力を停止' : '音声入力を開始') : '音声入力はこのブラウザで利用できません'}
            >
              {isListening ? 'Listening…' : '🎙️ Voice'}
            </button>
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
