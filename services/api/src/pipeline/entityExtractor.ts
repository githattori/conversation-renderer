import { maskPII } from '../guards.js';

// Support Latin capitalized terms and basic Japanese token boundaries（ひらがな・カタカナ・漢字のまとまり）
const ENTITY_REGEX = /(?:^|\b)([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)|([\u3040-\u30ff\u4e00-\u9faf]{2,})/g;

export function extractEntities(text: string): string[] {
  const sanitized = maskPII(text);
  const entities = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = ENTITY_REGEX.exec(sanitized)) !== null) {
    const entity = (match[1] || match[2] || '').trim();
    if (entity.length > 1 && entity.length < 50) {
      entities.add(entity);
    }
  }
  if (entities.size === 0) {
    // Accept arrow-separated flows and mixed language tokens
    const tokens = sanitized
      .split(/(?:->|→|⇒|➡︎|➡|→|\s|,|、|。|\.|;|:)+/)
      .filter((token) => token.length > 3)
      .slice(0, 5)
      .map((token) => token[0].toUpperCase() + token.slice(1));
    tokens.forEach((token) => entities.add(token));
  }
  return Array.from(entities);
}
