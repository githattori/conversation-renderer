import { maskPII } from '../guards.js';

// Support Latin capitalized terms and basic Japanese token boundaries（ひらがな・カタカナ・漢字のまとまり）
const ENTITY_REGEX = /(?:^|\b)([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)|([\u3040-\u30ff\u4e00-\u9faf]{2,})/g;

export function extractEntities(text: string): string[] {
  const sanitized = maskPII(text);
  const processed = sanitized.replace(/[→⇒➡︎➡]+/g, '->');
  const entities = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = ENTITY_REGEX.exec(processed)) !== null) {
    const entity = (match[1] || match[2] || '').trim();
    if (entity.length > 1 && entity.length < 50) {
      entities.add(entity);
    }
  }
  if (entities.size === 0) {
    const tokens = new Set<string>();
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      for (const { segment } of segmenter.segment(processed)) {
        const token = segment.trim();
        if (
          token.length > 1 &&
          token.length < 50 &&
          !/^[\p{P}\p{S}]+$/u.test(token) &&
          !/^[\u3040-\u309f]{1,2}$/u.test(token)
        ) {
          tokens.add(token);
        }
        if (tokens.size >= 5) {
          break;
        }
      }
    }
    if (tokens.size === 0) {
      const fallback = processed
        .split(/(?:->|\r?\n|,|、|。|\.|;|:)+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && token.length < 50)
        .slice(0, 5);
      fallback.forEach((token) => tokens.add(token));
    }
    tokens.forEach((token) => {
      const normalizedToken = token[0].toUpperCase() + token.slice(1);
      entities.add(normalizedToken);
    });
  }
  return Array.from(entities);
}
