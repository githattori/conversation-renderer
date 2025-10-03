import { describe, expect, it } from 'vitest';
import { DiagramService } from '../src/service.js';

describe('DiagramService', () => {
  it('creates session and generates mermaid DSL with guard rails', () => {
    const service = new DiagramService();
    const session = service.createSession('planner');

    const result = service.processMessage({
      sessionId: session.id,
      content: 'Process order intake -> Validate payment -> Schedule delivery for client alice@example.com',
    });

    expect(result.contract.diagram.format).toBe('mermaid');
    expect(result.contract.diagram.dsl).toMatchSnapshot('mermaid-dsl');
    expect(result.contract.diagram.layout.nodes).toHaveLength(3);
    expect(result.contract.conflicts).toEqual([]);
    expect(JSON.stringify(result.contract.diagram.dsl)).not.toContain('alice@example.com');
    expect(result.diff.addedNodes).toHaveLength(3);
  });

  it('flags isolated nodes and masks PII', () => {
    const service = new DiagramService();
    const session = service.createSession('analyst');

    const result = service.processMessage({
      sessionId: session.id,
      content: 'Escalation contact 555-555-5555',
    });

    expect(result.contract.conflicts.some((conflict) => conflict.includes('isolated'))).toBe(true);
    const layoutLabels = result.contract.diagram.layout.nodes.map((node) => node.label);
    expect(layoutLabels.join(' ')).not.toContain('555');
  });

  it('generates mindmap DSL when brainstorming context is detected', () => {
    const service = new DiagramService();
    const session = service.createSession('facilitator');

    service.processMessage({
      sessionId: session.id,
      content: 'Brainstorm ideas for launch including Marketing Plan, Engineering tasks, Customer Support readiness',
    });

    const exportPayload = service.exportSession(session.id);
    expect(exportPayload.contract?.diagram.format).toBe('mindmap');
    expect(exportPayload.contract?.diagram.dsl).toMatchSnapshot('mindmap-dsl');
  });

  it('allows reformatting a diagram into a different format', () => {
    const service = new DiagramService();
    const session = service.createSession('analyst');

    service.processMessage({
      sessionId: session.id,
      content: 'System components: API Gateway, Auth Service, Data Lake, BI Dashboard',
    });

    const contract = service.formatDiagram(session.id, 'mermaid');
    expect(contract.diagram.format).toBe('mermaid');
    expect(contract.diagram.dsl).toMatchSnapshot('formatted-mermaid-dsl');
  });
});
