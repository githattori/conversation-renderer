import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { sendDiagramUpdate, emitOperationalTransform } from '../services/realtime'
import {
  ApiRolePreset,
  MindmapDSL,
  ProcessMessageResponse,
  createSession,
  processChatMessage,
  requestCommandExecution,
} from '../services/api'

export type DiagramType = 'flowchart' | 'sequence' | 'mindmap'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface DiagramNode {
  id: string
  parentId: string | null
  label: string
}

export interface DiagramSnapshot {
  type: DiagramType
  mermaid: string
  mindmapNodes: DiagramNode[]
}

export interface HistoryEntry {
  id: string
  description: string
  createdAt: string
}

export interface RolePreset {
  id: string
  label: string
  description: string
  prompt: string
}

interface DiagramHistoryState {
  past: DiagramSnapshot[]
  present: DiagramSnapshot
  future: DiagramSnapshot[]
}

const initialMindmapRoot: DiagramNode = {
  id: nanoid(),
  parentId: null,
  label: 'Project Vision',
}

const initialSnapshot: DiagramSnapshot = {
  type: 'flowchart',
  mermaid: ['graph TD', '  Start[Idea]', '  Plan --> Build', '  Start --> Plan', '  Build --> Review', '  Review --> Launch'].join('\n'),
  mindmapNodes: [
    initialMindmapRoot,
    { id: nanoid(), parentId: initialMindmapRoot.id, label: 'Goals' },
    { id: nanoid(), parentId: initialMindmapRoot.id, label: 'Stakeholders' },
  ],
}

export interface AppState {
  chat: ChatMessage[]
  diagram: DiagramHistoryState
  selectedNodeId: string | null
  changeLog: HistoryEntry[]
  commandPaletteOpen: boolean
  activeRole: RolePreset | null
  sessionId: string | null
  isProcessingMessage: boolean
  rolePresets: RolePreset[]
  applyDiagramChange: (updater: (snapshot: DiagramSnapshot) => DiagramSnapshot, description: string) => void
  setDiagramType: (type: DiagramType) => void
  updateMermaid: (code: string) => void
  addMindmapChild: (parentId: string) => void
  updateMindmapLabel: (nodeId: string, label: string) => void
  removeMindmapNode: (nodeId: string) => void
  selectNode: (nodeId: string | null) => void
  undo: () => void
  redo: () => void
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => void
  appendHistory: (description: string) => void
  triggerSave: () => Promise<void>
  toggleCommandPalette: (open?: boolean) => void
  executeCommand: (command: string) => Promise<void>
  setRolePreset: (preset: RolePreset) => void
  processUserMessage: (content: string) => Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
}

const cloneSnapshot = (snapshot: DiagramSnapshot): DiagramSnapshot => ({
  type: snapshot.type,
  mermaid: snapshot.mermaid,
  mindmapNodes: snapshot.mindmapNodes.map((node) => ({ ...node })),
})

const buildHistoryEntry = (description: string): HistoryEntry => ({
  id: nanoid(),
  description,
  createdAt: new Date().toISOString(),
})

const rolePresets: RolePreset[] = [
  {
    id: 'architect',
    label: 'System Architect',
    description: 'Focus on technical design constraints',
    prompt: 'Provide architecture-centric feedback and highlight risks.',
  },
  {
    id: 'pm',
    label: 'Product Manager',
    description: 'Balance user value and delivery milestones',
    prompt: 'Summarise feature impact and prioritisation guidance.',
  },
  {
    id: 'facilitator',
    label: 'Workshop Facilitator',
    description: 'Guide collaborative diagramming sessions',
    prompt: 'Drive alignment and capture action items.',
  },
]

const snapshotRootId = (snapshot: DiagramSnapshot): string | null => {
  const root = snapshot.mindmapNodes.find((node) => node.parentId === null)
  return root ? root.id : null
}

const mapPresetToApiRole = (preset: RolePreset | null): ApiRolePreset => {
  if (!preset) return 'analyst'
  switch (preset.id) {
    case 'pm':
      return 'planner'
    case 'facilitator':
      return 'facilitator'
    default:
      return 'analyst'
  }
}

const isMindmapDSL = (dsl: unknown): dsl is MindmapDSL => {
  if (!dsl || typeof dsl !== 'object') return false
  return 'nodes' in (dsl as Record<string, unknown>) && 'edges' in (dsl as Record<string, unknown>)
}

const buildMindmapNodesFromDSL = (dsl: MindmapDSL): DiagramNode[] => {
  const parentMap = new Map<string, string | null>()
  parentMap.set(dsl.root, null)
  dsl.edges.forEach((edge) => {
    parentMap.set(edge.target, edge.source)
  })
  return dsl.nodes.map((node) => ({
    id: node.id,
    parentId: parentMap.has(node.id)
      ? parentMap.get(node.id) ?? null
      : node.id === dsl.root
        ? null
        : dsl.root,
    label: node.label ?? '',
  }))
}

const contractToSnapshot = (result: ProcessMessageResponse, previous: DiagramSnapshot): DiagramSnapshot => {
  if (result.diagram.format === 'mindmap' && isMindmapDSL(result.diagram.dsl)) {
    return {
      type: 'mindmap',
      mermaid: previous.mermaid,
      mindmapNodes: buildMindmapNodesFromDSL(result.diagram.dsl),
    }
  }

  return {
    type: previous.type === 'sequence' ? 'sequence' : 'flowchart',
    mermaid: typeof result.diagram.dsl === 'string' ? result.diagram.dsl : previous.mermaid,
    mindmapNodes: previous.mindmapNodes,
  }
}

const buildAssistantSummary = (result: ProcessMessageResponse): string => {
  const parts: string[] = []
  const formatLabel = result.diagram.format === 'mindmap' ? 'mindmap' : 'mermaid'
  parts.push(`Updated ${formatLabel} diagram.`)
  parts.push(
    `Nodes Δ +${result.diff.addedNodes.length} / -${result.diff.removedNodes.length}`,
    `Edges Δ +${result.diff.addedEdges.length} / -${result.diff.removedEdges.length}`,
  )
  if (Number.isFinite(result.diagram.confidence)) {
    parts.push(`Confidence ${Math.round(result.diagram.confidence * 100)}%`)
  }
  if (result.conflicts.length) {
    parts.push(`Conflicts: ${result.conflicts.join('; ')}`)
  }
  return parts.join(' ')
}

export const useAppStore = create<AppState>((set, get) => ({
  chat: [],
  diagram: { past: [], present: cloneSnapshot(initialSnapshot), future: [] },
  selectedNodeId: initialMindmapRoot.id,
  changeLog: [buildHistoryEntry('Initial workspace ready')],
  commandPaletteOpen: false,
  activeRole: null,
  sessionId: null,
  isProcessingMessage: false,
  rolePresets,
  applyDiagramChange: (updater, description) => {
    const { diagram, changeLog } = get()
    const current = diagram.present
    const next = updater(cloneSnapshot(current))
    set({
      diagram: {
        past: [...diagram.past, current],
        present: next,
        future: [],
      },
      changeLog: [buildHistoryEntry(description), ...changeLog],
    })
    sendDiagramUpdate(next)
  },
  setDiagramType: (type) => {
    get().applyDiagramChange((snapshot) => ({ ...snapshot, type }), `Diagram type switched to ${type}`)
  },
  updateMermaid: (code) => {
    if (get().diagram.present.mermaid === code) {
      return
    }
    get().applyDiagramChange((snapshot) => ({ ...snapshot, mermaid: code }), 'Mermaid definition updated')
  },
  addMindmapChild: (parentId) => {
    const child = { id: nanoid(), parentId, label: 'New idea' }
    get().applyDiagramChange(
      (snapshot) => ({
        ...snapshot,
        mindmapNodes: [...snapshot.mindmapNodes, child],
      }),
      'Mindmap node added',
    )
    set({ selectedNodeId: child.id })
    emitOperationalTransform({ type: 'mindmap.add', payload: child })
  },
  updateMindmapLabel: (nodeId, label) => {
    get().applyDiagramChange(
      (snapshot) => ({
        ...snapshot,
        mindmapNodes: snapshot.mindmapNodes.map((node) => (node.id === nodeId ? { ...node, label } : node)),
      }),
      'Mindmap node renamed',
    )
    emitOperationalTransform({ type: 'mindmap.rename', payload: { nodeId, label } })
  },
  removeMindmapNode: (nodeId) => {
    const { diagram } = get()
    const descendants = new Set<string>()
    const collect = (id: string) => {
      descendants.add(id)
      diagram.present.mindmapNodes
        .filter((node) => node.parentId === id)
        .forEach((child) => collect(child.id))
    }
    collect(nodeId)
    get().applyDiagramChange(
      (snapshot) => ({
        ...snapshot,
        mindmapNodes: snapshot.mindmapNodes.filter((node) => !descendants.has(node.id)),
      }),
      'Mindmap node removed',
    )
    set((state) => ({
      selectedNodeId:
        state.selectedNodeId && descendants.has(state.selectedNodeId)
          ? snapshotRootId(state.diagram.present)
          : state.selectedNodeId,
    }))
    emitOperationalTransform({ type: 'mindmap.remove', payload: { nodeId } })
  },
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  undo: () => {
    const { diagram, changeLog } = get()
    if (!diagram.past.length) return
    const previous = diagram.past[diagram.past.length - 1]
    set({
      diagram: {
        past: diagram.past.slice(0, -1),
        present: previous,
        future: [diagram.present, ...diagram.future],
      },
      changeLog: [buildHistoryEntry('Undo latest change'), ...changeLog],
    })
    sendDiagramUpdate(previous)
  },
  redo: () => {
    const { diagram, changeLog } = get()
    if (!diagram.future.length) return
    const [next, ...rest] = diagram.future
    set({
      diagram: {
        past: [...diagram.past, diagram.present],
        present: next,
        future: rest,
      },
      changeLog: [buildHistoryEntry('Redo change'), ...changeLog],
    })
    sendDiagramUpdate(next)
  },
  addChatMessage: (message) => {
    set((state) => ({
      chat: [
        ...state.chat,
        {
          id: nanoid(),
          role: message.role,
          content: message.content,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  },
  appendHistory: (description) => {
    set((state) => ({ changeLog: [buildHistoryEntry(description), ...state.changeLog] }))
  },
  triggerSave: async () => {
    get().appendHistory('Save triggered (stub)')
    await requestCommandExecution('save', get().diagram.present)
  },
  toggleCommandPalette: (open) => {
    set((state) => ({ commandPaletteOpen: open ?? !state.commandPaletteOpen }))
  },
  executeCommand: async (command) => {
    const trimmed = command.trim()
    if (!trimmed) return
    if (trimmed.startsWith('/diagram')) {
      const [, typeToken] = trimmed.split(/\s+/, 2)
      const normalized = (typeToken || '').toLowerCase() as DiagramType
      if (['flowchart', 'sequence', 'mindmap'].includes(normalized)) {
        get().setDiagramType(normalized)
        get().appendHistory(`Command palette: switched diagram to ${normalized}`)
        return
      }
    }
    await requestCommandExecution(trimmed, get().diagram.present)
    get().appendHistory(`Command executed: ${trimmed}`)
  },
  setRolePreset: (preset) => {
    set({ activeRole: preset, sessionId: null })
    get().appendHistory(`Role preset applied: ${preset.label}`)
    emitOperationalTransform({ type: 'session.role', payload: preset })
  },
  processUserMessage: async (content) => {
    const trimmed = content.trim()
    if (!trimmed || get().isProcessingMessage) {
      return
    }
    set({ isProcessingMessage: true })
    try {
      let sessionId = get().sessionId
      if (!sessionId) {
        const session = await createSession(mapPresetToApiRole(get().activeRole))
        sessionId = session.id
        set({ sessionId })
      }
      const result = await processChatMessage(sessionId, trimmed)
      const previous = get().diagram.present
      const snapshot = contractToSnapshot(result, previous)
      get().applyDiagramChange(() => snapshot, `Diagram updated via LLM (${result.diagram.format})`)
      get().addChatMessage({ role: 'assistant', content: buildAssistantSummary(result) })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      get().addChatMessage({ role: 'system', content: `Failed to update diagram: ${message}` })
      get().appendHistory('LLM update failed')
    } finally {
      set({ isProcessingMessage: false })
    }
  },
  canUndo: () => get().diagram.past.length > 0,
  canRedo: () => get().diagram.future.length > 0,
}))
