import { dagreLayout, sugiyamaLayout } from '../layout.js';
import {
  DiagramContext,
  DiagramContract,
  DiagramEdge,
  DiagramFormat,
  DiagramNode,
  DiagramPayload,
  DiffPatch,
} from '../types.js';

function buildMermaid(nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const header = 'flowchart LR';
  const nodeLines = nodes.map((node) => `${node.id}[${node.label}]`);
  const edgeLines = edges.map((edge) => `${edge.source} -->${edge.label ? `|${edge.label}|` : ''} ${edge.target}`);
  return [header, ...nodeLines, ...edgeLines].join('\n');
}

function buildMindmap(nodes: DiagramNode[], edges: DiagramEdge[]): Record<string, unknown> {
  return {
    root: nodes[0]?.id ?? 'root',
    nodes: nodes.map((node) => ({ id: node.id, label: node.label, level: node.level ?? 0 })),
    edges: edges.map((edge) => ({ source: edge.source, target: edge.target, label: edge.label ?? null })),
  };
}

function buildEdges(nodes: DiagramNode[], format: DiagramFormat): DiagramEdge[] {
  if (nodes.length <= 1) return [];
  if (format === 'mindmap') {
    const root = nodes[0];
    return nodes.slice(1).map((node) => ({
      id: `${root.id}-${node.id}`,
      source: root.id,
      target: node.id,
    }));
  }
  return nodes.slice(1).map((node, idx) => ({
    id: `${nodes[idx].id}-${node.id}`,
    source: nodes[idx].id,
    target: node.id,
  }));
}

export function buildContext(entities: string[], diagramType: DiagramFormat): DiagramContext {
  const nodes: DiagramNode[] = entities.map((entity, idx) => ({
    id: `node_${idx}`,
    label: entity,
    level: idx === 0 ? 0 : Math.floor(idx / 3) + 1,
  }));
  const edges = buildEdges(nodes, diagramType);
  return { entities, diagramType, nodes, edges };
}

export function buildDSL(context: DiagramContext): DiagramPayload {
  const layout = context.diagramType === 'mermaid'
    ? dagreLayout(context.nodes, context.edges)
    : sugiyamaLayout(context.nodes, context.edges);

  const dsl = context.diagramType === 'mermaid'
    ? buildMermaid(context.nodes, context.edges)
    : buildMindmap(context.nodes, context.edges);

  return {
    format: context.diagramType,
    dsl,
    layout,
    confidence: Math.min(1, 0.5 + context.entities.length * 0.05),
  };
}

export function computeDiffPatch(previous: DiagramContext | null, next: DiagramContext): DiffPatch {
  if (!previous) {
    return {
      addedNodes: next.nodes,
      removedNodes: [],
      addedEdges: next.edges,
      removedEdges: [],
    };
  }
  const prevNodeIds = new Set(previous.nodes.map((node) => node.id));
  const prevEdgeIds = new Set(previous.edges.map((edge) => edge.id));
  const addedNodes = next.nodes.filter((node) => !prevNodeIds.has(node.id));
  const removedNodes = previous.nodes.filter((node) => !next.nodes.find((n) => n.id === node.id));
  const addedEdges = next.edges.filter((edge) => !prevEdgeIds.has(edge.id));
  const removedEdges = previous.edges.filter((edge) => !next.edges.find((e) => e.id === edge.id));

  return { addedNodes, removedNodes, addedEdges, removedEdges };
}

export function buildContract(context: DiagramContext, diff: DiffPatch): DiagramContract {
  const diagram = buildDSL(context);
  const conflicts = diff.removedNodes.length > 0 ? ['Nodes removed from diagram'] : [];
  return {
    diagram,
    conflicts,
  };
}
