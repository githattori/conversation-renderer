import { maskPII } from '../guards.js';

const ENTITY_REGEX = /(?:^|\b)([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)/g;

export function extractEntities(text: string): string[] {
  const sanitized = maskPII(text);
  const entities = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = ENTITY_REGEX.exec(sanitized)) !== null) {
    const entity = match[1].trim();
    if (entity.length > 1 && entity.length < 50) {
      entities.add(entity);
    }
  }
  if (entities.size === 0) {
    const tokens = sanitized
      .split(/[^a-zA-Z0-9]+/)
      .filter((token) => token.length > 3)
      .slice(0, 5)
      .map((token) => token[0].toUpperCase() + token.slice(1));
    tokens.forEach((token) => entities.add(token));
  }
  return Array.from(entities);
}
