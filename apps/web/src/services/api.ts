import type { DiagramSnapshot } from '../state/store'

// In dev, prefer relative path to use Vite proxy. Allow override via VITE_API_BASE_URL.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const buildUrl = (path: string) => {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '')
  return `${normalizedBase}${path}`
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text()
  if (!response.ok) {
    const message = text || response.statusText || 'Request failed'
    throw new Error(message)
  }
  try {
    return text ? (JSON.parse(text) as T) : ({} as T)
  } catch (error) {
    throw new Error('Failed to parse server response')
  }
}

export type ApiRolePreset = 'analyst' | 'facilitator' | 'planner'

export interface SessionResponse {
  id: string
  role: ApiRolePreset
  createdAt: string
}

export interface MindmapNodePayload {
  id: string
  label: string
  level?: number
}

export interface MindmapEdgePayload {
  source: string
  target: string
  label?: string | null
}

export interface MindmapDSL {
  root: string
  nodes: MindmapNodePayload[]
  edges: MindmapEdgePayload[]
}

export interface DiagramNodePayload {
  id: string
  label: string
  type?: string
  level?: number
}

export interface DiagramEdgePayload {
  id: string
  source: string
  target: string
  label?: string
}

export interface DiagramPayloadResponse {
  format: 'mermaid' | 'mindmap'
  dsl: string | MindmapDSL
  layout: {
    nodes: Array<DiagramNodePayload & { x: number; y: number }>
    edges: DiagramEdgePayload[]
  }
  confidence: number
}

export interface DiffPatchResponse {
  addedNodes: DiagramNodePayload[]
  removedNodes: DiagramNodePayload[]
  addedEdges: DiagramEdgePayload[]
  removedEdges: DiagramEdgePayload[]
}

export interface DiagramContractResponse {
  diagram: DiagramPayloadResponse
  conflicts: string[]
}

export interface ProcessMessageResponse {
  diagram: DiagramPayloadResponse
  conflicts: string[]
  diff: DiffPatchResponse
  systemPrompt: string
}

export const createSession = async (role: ApiRolePreset): Promise<SessionResponse> => {
  const response = await fetch(buildUrl('/v1/sessions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  return parseResponse<SessionResponse>(response)
}

export const processChatMessage = async (
  sessionId: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<ProcessMessageResponse> => {
  const response = await fetch(buildUrl('/v1/messages'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, content, metadata }),
  })
  return parseResponse<ProcessMessageResponse>(response)
}

export const requestCommandExecution = async (command: string, snapshot: DiagramSnapshot) => {
  console.info('[api] command dispatched (stub)', command, snapshot)
  await new Promise((resolve) => setTimeout(resolve, 150))
  return { status: 'queued' as const }
}
