export type RolePreset = 'analyst' | 'facilitator' | 'planner';

export interface Session {
  id: string;
  role: RolePreset;
  createdAt: string;
}

export interface MessageInput {
  sessionId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DiagramNode {
  id: string;
  label: string;
  type?: string;
  level?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export type DiagramFormat = 'mermaid' | 'mindmap';

export interface DiagramPayload {
  format: DiagramFormat;
  dsl: string | Record<string, unknown>;
  layout: LayoutResult;
  confidence: number;
}

export interface DiagramContract {
  diagram: DiagramPayload;
  conflicts: string[];
}

export interface LayoutResult {
  nodes: Array<DiagramNode & { x: number; y: number }>;
  edges: DiagramEdge[];
}

export interface DiagramContext {
  entities: string[];
  diagramType: DiagramFormat;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface DiffPatch {
  addedNodes: DiagramNode[];
  removedNodes: DiagramNode[];
  addedEdges: DiagramEdge[];
  removedEdges: DiagramEdge[];
}
