import dagre from 'dagre';
import { DiagramEdge, DiagramNode, LayoutResult } from './types.js';

export function dagreLayout(nodes: DiagramNode[], edges: DiagramEdge[]): LayoutResult {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 60 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: Math.max(80, node.label.length * 8), height: 40, node });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, { edge });
  }

  dagre.layout(graph);

  const layoutNodes = nodes.map((node) => {
    const nodeWithPos = graph.node(node.id);
    return {
      ...node,
      x: nodeWithPos?.x ?? 0,
      y: nodeWithPos?.y ?? 0,
    };
  });

  return {
    nodes: layoutNodes,
    edges,
  };
}

export function sugiyamaLayout(nodes: DiagramNode[], edges: DiagramEdge[]): LayoutResult {
  const ranked = new Map<number, DiagramNode[]>();
  for (const node of nodes) {
    const level = node.level ?? 0;
    if (!ranked.has(level)) ranked.set(level, []);
    ranked.get(level)!.push(node);
  }
  const sortedLevels = Array.from(ranked.keys()).sort((a, b) => a - b);
  const layoutNodes: Array<DiagramNode & { x: number; y: number }> = [];
  const spacingX = 180;
  const spacingY = 90;
  sortedLevels.forEach((level, idx) => {
    const nodesAtLevel = ranked.get(level)!;
    nodesAtLevel.forEach((node, nodeIdx) => {
      layoutNodes.push({
        ...node,
        x: nodeIdx * spacingX,
        y: idx * spacingY,
      });
    });
  });

  return {
    nodes: layoutNodes,
    edges,
  };
}
