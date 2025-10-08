import { maskPII } from '../guards.js';

// Support Latin capitalized terms and basic Japanese token boundaries（ひらがな・カタカナ・漢字のまとまり）
const ENTITY_REGEX = /(?:^|\b)([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)|([\u3040-\u30ff\u4e00-\u9faf]{2,})/g;

const SENTENCE_SEPARATORS = /(?:->|\r?\n|,|、|。|;|:|！|!|？|\?|そして|それから|その後|次に|続いて|まず|最後に|さらに|加えて)+/g;

const CLAUSE_BOUNDARIES =
  /(?<=\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana})(?:て|で|って|たら|たり|た後|ながら|つつ|ば|なら)(?=\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana})/gu;

const PARTICLE_PATTERN = /^[\u3040-\u309f]{1,2}$/u;

const PUNCTUATION_PATTERN = /^[\p{P}\p{S}]+$/u;

const CANONICAL_RULES: Array<[RegExp, string]> = [
  [/起き|目覚|起床/u, '起床'],
  [/(洗顔|歯磨|身支度|支度|準備)/u, '支度'],
  [/(朝食|昼食|夕食|食事|ご飯|ランチ|ディナー|食べ|飲む)/u, '食事'],
  [/(出勤|通勤|仕事|勤務|働)/u, '仕事'],
  [/(学校|登校)/u, '学校'],
  [/(移動|向か|行く|出発|乗車)/u, '移動'],
  [/(会議|ミーティング)/u, '会議'],
  [/(買い物|ショッピング)/u, '買い物'],
  [/(帰宅|帰る|帰路)/u, '帰宅'],
  [/(入浴|風呂|お風呂)/u, '入浴'],
  [/(寝|就寝|眠)/u, '就寝'],
];

function normalizeClause(clause: string): string | null {
  let text = clause
    .replace(/^[0-9０-９]+\s*[\.．:：]/u, '')
    .replace(/^(?:そして|それから|その後|次に|まず|最後に|さらに|また|それでは)\s*/u, '')
    .trim();

  if (!text) {
    return null;
  }

  text = text
    .replace(/[\u3040-\u309f]{1,2}$/u, (suffix) =>
      ['て', 'で', 'って', 'た', 'たら', 'たり', 'ば', 'な', 'ね', 'よ', 'ねえ'].includes(suffix) ? '' : suffix,
    )
    .replace(/(?:する|した|して|してる|している|しよう|していく|しておく|してから)$/u, '')
    .replace(/(?:行っ|行き)$/u, '行く')
    .replace(/(?:帰っ)$/u, '帰る')
    .replace(/(?:食べ)$/u, '食べる')
    .replace(/(?:飲ん)$/u, '飲む')
    .replace(/(?:準備する)$/u, '準備');

  for (const [pattern, label] of CANONICAL_RULES) {
    if (pattern.test(text)) {
      text = label;
      break;
    }
  }

  text = text
    .replace(/[\u3040-\u309f]{1,2}$/u, '')
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
    .replace(/^(?:を|に|へ|が|は|で|と|や|も|から|まで|より)/u, '')
    .replace(/(?:を|に|へ|が|は|で|と|や|も|から|まで|より)$/u, '')
    .trim();

  if (!text || text.length === 1) {
    return null;
  }

  return text.length > 30 ? text.slice(0, 30) : text;
}

function segmentJapanese(text: string): string[] {
  const base = text
    .split(SENTENCE_SEPARATORS)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const sentence of base) {
    const clauses = sentence
      .split(CLAUSE_BOUNDARIES)
      .map((clause) => clause.trim())
      .filter(Boolean);
    segments.push(...clauses);
  }
  return segments;
}

function collectJapaneseSteps(text: string): string[] {
  const segments = segmentJapanese(text);
  const steps: string[] = [];
  for (const segment of segments) {
    const normalized = normalizeClause(segment);
    if (normalized && !steps.includes(normalized)) {
      steps.push(normalized);
    }
    if (steps.length >= 8) {
      break;
    }
  }
  return steps;
}

function collectSegmentedTokens(processed: string): string[] {
  const tokens: string[] = [];
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    for (const { segment } of segmenter.segment(processed)) {
      const token = segment.trim();
      if (
        token.length > 1 &&
        token.length < 50 &&
        !PUNCTUATION_PATTERN.test(token) &&
        !PARTICLE_PATTERN.test(token)
      ) {
        tokens.push(token);
      }
      if (tokens.length >= 8) {
        break;
      }
    }
  }
  return tokens;
}

function fallbackTokens(processed: string): string[] {
  return processed
    .split(SENTENCE_SEPARATORS)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && token.length < 50)
    .slice(0, 8);
}

export function extractEntities(text: string): string[] {
  const sanitized = maskPII(text);
  const processed = sanitized.replace(/[→⇒➡︎➡➔➜➝➞➟➠➤➥➦➧➨➩➪➫➬➭➮➯➰➱➲➳➴➵➶➷➸➹➺➻➼➽➾]/g, '->');

  const containsJapanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(processed);
  if (containsJapanese) {
    const proceduralSteps = collectJapaneseSteps(processed);
    if (proceduralSteps.length > 0) {
      return proceduralSteps;
    }
  }

  const entities = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = ENTITY_REGEX.exec(processed)) !== null) {
    const entity = (match[1] || match[2] || '').trim();
    if (entity.length > 1 && entity.length < 50) {
      entities.add(entity);
    }
  }

  if (entities.size === 0) {
    const segmented = collectSegmentedTokens(processed);
    if (segmented.length > 0) {
      segmented.forEach((token) => entities.add(token));
    }
  }

  if (entities.size === 0) {
    fallbackTokens(processed).forEach((token) => entities.add(token));
  }

  return Array.from(entities);
}
