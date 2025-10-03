import type { DiagramSnapshot, RolePreset } from '../state/store'

type RealtimeEvent =
  | { type: 'mindmap.add'; payload: { id: string; parentId: string; label: string } }
  | { type: 'mindmap.rename'; payload: { nodeId: string; label: string } }
  | { type: 'mindmap.remove'; payload: { nodeId: string } }
  | { type: 'session.role'; payload: RolePreset }
  | { type: 'diagram.update'; payload: DiagramSnapshot }

export const sendDiagramUpdate = (snapshot: DiagramSnapshot) => {
  console.info('[ws] diagram.update (stub)', snapshot)
}

export const emitOperationalTransform = (event: RealtimeEvent) => {
  console.info('[ws] ot event (stub)', event)
}

export const connectRealtime = (onMessage: (event: RealtimeEvent) => void) => {
  console.info('[ws] connect (stub)')
  void onMessage
  return () => {
    console.info('[ws] disconnect (stub)')
  }
}
