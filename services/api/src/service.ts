import { applyGuardRails } from './guards.js';
import { buildSystemPrompt } from './presets.js';
import { buildContext, buildContract, computeDiffPatch } from './pipeline/dslBuilders.js';
import { extractEntities } from './pipeline/entityExtractor.js';
import { inferDiagramType } from './pipeline/diagramType.js';
import { SessionStore } from './sessionStore.js';
import {
  DiagramContract,
  DiagramContext,
  DiagramFormat,
  DiffPatch,
  MessageInput,
  RolePreset,
  Session,
} from './types.js';

interface ProcessResult {
  contract: DiagramContract;
  diff: DiffPatch;
  systemPrompt: string;
}

export class DiagramService {
  private store: SessionStore;
  private contexts = new Map<string, DiagramContext>();

  constructor(store?: SessionStore) {
    this.store = store ?? new SessionStore();
  }

  createSession(role: RolePreset): Session {
    return this.store.create(role);
  }

  getSession(sessionId: string): Session | undefined {
    return this.store.get(sessionId);
  }

  private setContext(sessionId: string, context: DiagramContext): void {
    this.contexts.set(sessionId, context);
  }

  private getContext(sessionId: string): DiagramContext | undefined {
    return this.contexts.get(sessionId);
  }

  processMessage(input: MessageInput): ProcessResult {
    const session = this.getSession(input.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    this.store.appendMessage(input);

    const history = this.store.getHistory(input.sessionId);
    const combinedText = history.map((item) => item.content).join('\n');

    const entities = extractEntities(combinedText);
    const diagramType = inferDiagramType(entities, combinedText);
    const context = buildContext(entities, diagramType);
    const diff = computeDiffPatch(this.getContext(input.sessionId) ?? null, context);
    this.setContext(input.sessionId, context);

    const contract = applyGuardRails(buildContract(context, diff));
    const systemPrompt = buildSystemPrompt(session.role);

    return { contract, diff, systemPrompt };
  }

  formatDiagram(sessionId: string, format: DiagramFormat): DiagramContract {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    const previous = this.getContext(sessionId);
    if (!previous) {
      throw new Error('No diagram available for session');
    }
    const context = buildContext(previous.entities, format);
    const diff = computeDiffPatch(previous, context);
    this.setContext(sessionId, context);
    return applyGuardRails(buildContract(context, diff));
  }

  exportSession(sessionId: string): Record<string, unknown> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    const context = this.getContext(sessionId);
    const contract = context
      ? applyGuardRails(buildContract(context, computeDiffPatch(context, context)))
      : null;
    return {
      session,
      history: this.store.getHistory(sessionId),
      contract,
    };
  }
}
