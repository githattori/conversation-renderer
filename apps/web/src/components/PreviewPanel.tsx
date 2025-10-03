import { useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Markmap } from 'markmap-view'
import { Transformer } from 'markmap-lib'
import { useAppStore } from '../state/store'
import { buildMindmapMarkdown, getMindmapChildren } from '../utils/mindmap'
import clsx from 'clsx'

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
const transformer = new Transformer()

export const PreviewPanel = () => {
  const diagram = useAppStore((state) => state.diagram.present)
  const setDiagramType = useAppStore((state) => state.setDiagramType)
  const updateMermaid = useAppStore((state) => state.updateMermaid)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const canUndoValue = useAppStore((state) => state.canUndo())
  const canRedoValue = useAppStore((state) => state.canRedo())
  const triggerSave = useAppStore((state) => state.triggerSave)
  const addMindmapChild = useAppStore((state) => state.addMindmapChild)
  const updateMindmapLabel = useAppStore((state) => state.updateMindmapLabel)
  const removeMindmapNode = useAppStore((state) => state.removeMindmapNode)
  const selectedNodeId = useAppStore((state) => state.selectedNodeId)
  const selectNode = useAppStore((state) => state.selectNode)

  const mermaidRef = useRef<HTMLDivElement>(null)
  const markmapSvgRef = useRef<SVGSVGElement | null>(null)
  const markmapInstance = useRef<Markmap | null>(null)
  const [mermaidDraft, setMermaidDraft] = useState(diagram.mermaid)
  const [labelDraft, setLabelDraft] = useState('')

  const rootNode = useMemo(() => diagram.mindmapNodes.find((node) => node.parentId === null) || null, [diagram.mindmapNodes])
  const selectedNode = useMemo(
    () => diagram.mindmapNodes.find((node) => node.id === selectedNodeId) ?? rootNode,
    [diagram.mindmapNodes, selectedNodeId, rootNode],
  )

  useEffect(() => {
    setMermaidDraft(diagram.mermaid)
  }, [diagram.mermaid])

  useEffect(() => {
    setLabelDraft(selectedNode?.label ?? '')
  }, [selectedNode?.id, selectedNode?.label])

  useEffect(() => {
    if (diagram.type === 'mindmap') {
      const markdown = buildMindmapMarkdown(diagram.mindmapNodes)
      const { root } = transformer.transform(markdown)
      if (markmapSvgRef.current) {
        markmapInstance.current = markmapInstance.current || Markmap.create(markmapSvgRef.current)
        markmapInstance.current.setData(root)
        markmapInstance.current.fit()
      }
      return
    }
    if (mermaidRef.current) {
      const renderId = `mermaid-${Date.now()}`
      mermaid
        .render(renderId, diagram.mermaid)
        .then(({ svg }) => {
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = svg
          }
        })
        .catch((error) => {
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = `<pre class="mermaid-error">${String(error)}</pre>`
          }
        })
    }
  }, [diagram])

  useEffect(() => {
    const handle = setTimeout(() => {
      if (diagram.mermaid !== mermaidDraft) {
        updateMermaid(mermaidDraft)
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [diagram.mermaid, mermaidDraft, updateMermaid])

  const changeType = (type: typeof diagram.type) => setDiagramType(type)

  const handleAddChild = () => {
    const targetId = selectedNode?.id || rootNode?.id
    if (targetId) {
      addMindmapChild(targetId)
    }
  }

  const handleRename = () => {
    if (selectedNode) {
      updateMindmapLabel(selectedNode.id, labelDraft)
    }
  }

  const handleRemove = () => {
    if (!selectedNode || selectedNode.parentId === null) return
    removeMindmapNode(selectedNode.id)
  }

  const renderMindmapTree = (parentId: string | null, depth = 0) => {
    const children = getMindmapChildren(diagram.mindmapNodes, parentId)
    if (!children.length) return null
    return (
      <ul className="mindmap-tree">
        {children.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              className={clsx('node-button', { active: child.id === selectedNode?.id })}
              onClick={() => selectNode(child.id)}
              style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
            >
              {child.label || 'Untitled node'}
            </button>
            {renderMindmapTree(child.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="pane preview-pane">
      <header className="pane-header">
        <div>
          <h2>Diagram Preview</h2>
          <p className="subtle">Switch diagram type or update content — preview updates automatically.</p>
        </div>
        <div className="toolbar">
          {(['flowchart', 'sequence', 'mindmap'] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={clsx('ghost', { active: diagram.type === type })}
              onClick={() => changeType(type)}
            >
              {type}
            </button>
          ))}
          <div className="divider" />
          <button type="button" className="ghost" onClick={undo} disabled={!canUndoValue}>
            ⌘Z Undo
          </button>
          <button type="button" className="ghost" onClick={redo} disabled={!canRedoValue}>
            ⌘Y Redo
          </button>
          <button type="button" className="primary" onClick={() => triggerSave()}>
            ⌘S Save Snapshot
          </button>
        </div>
      </header>
      <div className="preview-body">
        <div className="diagram-canvas" aria-live="polite">
          {diagram.type === 'mindmap' ? <svg ref={markmapSvgRef} /> : <div ref={mermaidRef} />}
        </div>
        <aside className="diagram-editors">
          {diagram.type === 'mindmap' ? (
            <div className="editor-card">
              <h3>Mindmap Nodes</h3>
              {rootNode ? (
                <>
                  <div className="mindmap-controls">
                    <label>
                      Selected node
                      <input
                        value={labelDraft}
                        onChange={(event) => setLabelDraft(event.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleRename()
                          }
                        }}
                      />
                    </label>
                    <div className="actions">
                      <button type="button" onClick={handleAddChild} className="ghost">
                        Add child
                      </button>
                      <button type="button" onClick={handleRemove} className="ghost" disabled={!selectedNode || selectedNode.parentId === null}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <nav className="tree-view" aria-label="Mindmap nodes">
                    <button
                      type="button"
                      className={clsx('node-button', { active: selectedNode?.id === rootNode.id })}
                      onClick={() => selectNode(rootNode.id)}
                    >
                      {rootNode.label}
                    </button>
                    {renderMindmapTree(rootNode.id)}
                  </nav>
                </>
              ) : (
                <p className="empty-state">Add nodes to start your mindmap.</p>
              )}
            </div>
          ) : (
            <div className="editor-card">
              <h3>Mermaid Source</h3>
              <textarea
                value={mermaidDraft}
                onChange={(event) => setMermaidDraft(event.target.value)}
                rows={16}
                spellCheck={false}
              />
              <p className="hint">Supports flowchart and sequence syntax.</p>
            </div>
          )}
          <div className="shortcut-card">
            <h3>Shortcuts</h3>
            <ul>
              <li>⌘Z / Ctrl+Z — Undo</li>
              <li>⌘Y / Ctrl+Y — Redo</li>
              <li>⌘S / Ctrl+S — Save snapshot</li>
              <li>⌘K / Ctrl+K — Command palette</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}
