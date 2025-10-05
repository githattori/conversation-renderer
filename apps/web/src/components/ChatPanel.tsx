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
  const {
    supported: speechSupported,
    listening: isListening,
    start: startListening,
    stop: stopListening,
    transcript,
    interimTranscript,
  } = useSpeechRecognition({ interimResults: true })
  const [isVoiceCapturing, setIsVoiceCapturing] = useState(false)
  const [isVoiceSubmitting, setIsVoiceSubmitting] = useState(false)
  const previousInputRef = useRef('')

  useEffect(() => {
    if (!isVoiceCapturing || isVoiceSubmitting) return

    const combinedTranscript = [transcript, interimTranscript].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (combinedTranscript) {
      setInput(combinedTranscript)
    } else if (!isListening) {
      setInput(previousInputRef.current)
    }
  }, [interimTranscript, isListening, isVoiceCapturing, isVoiceSubmitting, transcript])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content) return

      if (content.startsWith('/')) {
        await executeCommand(content)
      } else {
        addChatMessage({ role: 'user', content })
        appendHistory('User message captured')
      }
      setInput('')
    },
    [addChatMessage, appendHistory, executeCommand],
  )

  useEffect(() => {
    if (!isVoiceCapturing || isListening) return

    const trimmed = transcript.trim()
    if (!trimmed) {
      setIsVoiceCapturing(false)
      setIsVoiceSubmitting(false)
      setInput(previousInputRef.current)
      previousInputRef.current = ''
      return
    }

    const dispatchVoiceMessage = async () => {
      setIsVoiceSubmitting(true)
      await sendMessage(trimmed)
      setIsVoiceCapturing(false)
      setIsVoiceSubmitting(false)
      previousInputRef.current = ''
    }

    void dispatchVoiceMessage()
  }, [isListening, isVoiceCapturing, sendMessage, transcript])

  const sortedMessages = useMemo(() => chat.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [chat])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isVoiceSubmitting) return
    const trimmed = input.trim()
    if (!trimmed) return
    await sendMessage(trimmed)
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return

    if (event.metaKey || (!event.shiftKey && !event.ctrlKey && !event.altKey)) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const hintMessage = speechSupported
    ? isVoiceCapturing
      ? '音声入力中…話し終えると自動的に送信されます'
      : 'Enter または ⌘Enter で送信 · Shift+Enter で改行 · 🎙️ で音声入力'
    : 'Enter または ⌘Enter で送信 · Shift+Enter で改行'

  const displayedHint = isVoiceSubmitting
    ? '音声入力を送信中…'
    : isVoiceCapturing && !isListening
      ? '音声入力を処理中…'
      : hintMessage

  const handleVoiceButtonClick = () => {
    if (!speechSupported) return

    if (isListening) {
      stopListening()
      return
    }

    previousInputRef.current = input
    setIsVoiceCapturing(true)
    setIsVoiceSubmitting(false)
    setInput('')
    startListening()
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
          onKeyDown={handleTextareaKeyDown}
          placeholder={
            isVoiceCapturing || isVoiceSubmitting
              ? '音声入力中です。話し終えると自動送信されます。'
              : 'Type messages or commands. Try /diagram mindmap'
          }
          rows={4}
          className={clsx({ 'voice-capturing': isVoiceCapturing || isVoiceSubmitting })}
          readOnly={isVoiceCapturing || isVoiceSubmitting}
          aria-live={isVoiceCapturing || isVoiceSubmitting ? 'polite' : undefined}
        />
        <div className="chat-actions">
          <span
            className="hint"
            aria-live="polite"
            data-voice-active={isVoiceCapturing || isVoiceSubmitting}
          >
            {displayedHint}
          </span>
          <div className="chat-actions-buttons">
            <button
              className={clsx('ghost', { active: isListening || isVoiceCapturing || isVoiceSubmitting })}
              type="button"
              onClick={handleVoiceButtonClick}
              disabled={!speechSupported || isVoiceSubmitting}
              aria-pressed={isListening || isVoiceCapturing || isVoiceSubmitting}
              aria-label={
                isVoiceSubmitting
                  ? '音声入力を送信中'
                  : isListening
                    ? '音声入力を停止'
                    : '音声入力を開始'
              }
              title={
                speechSupported
                  ? isVoiceSubmitting
                    ? '音声入力を送信中'
                    : isListening || isVoiceCapturing
                      ? '音声入力を停止'
                      : '音声入力を開始'
                  : '音声入力はこのブラウザで利用できません'
              }
            >
              {isVoiceSubmitting ? 'Sending…' : isListening ? 'Listening…' : '🎙️ Voice'}
            </button>
            <button className="ghost" type="button" onClick={() => toggleCommandPalette(true)}>
              Presets & Commands
            </button>
            <button type="submit" className="primary" disabled={isVoiceSubmitting}>
              Send
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
