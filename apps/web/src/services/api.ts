import type { DiagramSnapshot } from '../state/store'

export const requestCommandExecution = async (command: string, snapshot: DiagramSnapshot) => {
  console.info('[api] command dispatched (stub)', command, snapshot)
  await new Promise((resolve) => setTimeout(resolve, 150))
  return { status: 'queued' as const }
}
