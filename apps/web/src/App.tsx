import { useEffect } from 'react'
import './App.css'
import { ChatPanel } from './components/ChatPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { CommandPalette } from './components/CommandPalette'
import { useShortcutHandlers } from './hooks/useShortcutHandlers'
import { connectRealtime } from './services/realtime'

function App() {
  useShortcutHandlers()

  useEffect(() => {
    const disconnect = connectRealtime(() => undefined)
    return () => disconnect()
  }, [])

  return (
    <div className="app-shell">
      <ChatPanel />
      <PreviewPanel />
      <HistoryPanel />
      <CommandPalette />
    </div>
  )
}

export default App
