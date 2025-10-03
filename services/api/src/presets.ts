import { RolePreset } from './types.js';

export const rolePrompts: Record<RolePreset, string> = {
  analyst:
    'You are an analyst summarizing entities and relationships from stakeholder conversations. Produce structured diagrams that highlight dependencies.',
  facilitator:
    'You are a workshop facilitator capturing brainstorming sessions. Surface clusters of related ideas and mind-map style diagrams.',
  planner:
    'You are a project planner outlining milestones and tasks. Produce flow style diagrams to communicate sequencing and ownership.',
};

export function buildSystemPrompt(role: RolePreset): string {
  return `${rolePrompts[role]}\nAlways respond using the JSON contract {"diagram":{...},"conflicts":[]}.`;
}
