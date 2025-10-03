import { DiagramFormat } from '../types.js';

export function inferDiagramType(entities: string[], message: string): DiagramFormat {
  const lower = message.toLowerCase();
  if (lower.includes('flow') || lower.includes('process') || lower.includes('step')) {
    return 'mermaid';
  }
  if (lower.includes('idea') || lower.includes('brainstorm') || lower.includes('mind')) {
    return 'mindmap';
  }
  if (entities.length <= 4) {
    return 'mermaid';
  }
  return 'mindmap';
}
