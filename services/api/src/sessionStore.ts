import { nanoid } from 'nanoid';
import { MessageInput, RolePreset, Session } from './types.js';

export class SessionStore {
  private sessions = new Map<string, Session>();
  private history = new Map<string, MessageInput[]>();

  create(role: RolePreset): Session {
    const id = nanoid();
    const session: Session = { id, role, createdAt: new Date().toISOString() };
    this.sessions.set(id, session);
    this.history.set(id, []);
    return session;
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  appendMessage(input: MessageInput): void {
    const list = this.history.get(input.sessionId);
    if (!list) {
      throw new Error('Session not found');
    }
    list.push(input);
  }

  getHistory(sessionId: string): MessageInput[] {
    return this.history.get(sessionId) ?? [];
  }
}
