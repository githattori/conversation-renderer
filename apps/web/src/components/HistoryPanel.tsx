import { useMemo } from 'react'
import { useAppStore } from '../state/store'

export const HistoryPanel = () => {
  const changeLog = useAppStore((state) => state.changeLog)
  const ordered = useMemo(() => changeLog.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [changeLog])

  return (
    <section className="pane history-pane">
      <header className="pane-header">
        <h2>Change History</h2>
      </header>
      <ol className="history-list">
        {ordered.map((entry) => (
          <li key={entry.id}>
            <span>{entry.description}</span>
            <time>{new Date(entry.createdAt).toLocaleTimeString()}</time>
          </li>
        ))}
      </ol>
    </section>
  )
}
