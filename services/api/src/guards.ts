import { DiagramContract, DiagramNode } from './types.js';

const EMAIL_REGEX = /([\w.+-]+)@([\w.-]+)\.([a-zA-Z]{2,})/g;
const PHONE_REGEX = /(\+?\d{1,3}[ -]?)?(\(?\d{3}\)?[ -]?)?\d{3}[ -]?\d{4}/g;

export function maskPII(text: string): string {
  return text
    .replace(EMAIL_REGEX, '***@***')
    .replace(PHONE_REGEX, (match) => '*'.repeat(Math.min(match.length, 8)));
}

export function detectIsolatedNodes(nodes: DiagramNode[], edges: { source: string; target: string }[]): string[] {
  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  return nodes.filter((node) => !connected.has(node.id)).map((node) => `Node ${node.label} is isolated`);
}

export function applyGuardRails(contract: DiagramContract): DiagramContract {
  const maskedLayoutNodes = contract.diagram.layout.nodes.map((node) => ({
    ...node,
    label: maskPII(node.label),
  }));

  const conflicts = [...contract.conflicts];
  conflicts.push(...detectIsolatedNodes(maskedLayoutNodes, contract.diagram.layout.edges));

  return {
    ...contract,
    diagram: {
      ...contract.diagram,
      layout: {
        ...contract.diagram.layout,
        nodes: maskedLayoutNodes,
      },
    },
    conflicts,
  };
}
