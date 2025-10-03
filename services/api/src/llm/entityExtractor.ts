import { DiagramFormat, RolePreset } from '../types.js';

export interface LLMEntityExtraction {
  entities: string[];
  diagramType?: DiagramFormat;
}

export interface LLMEntityExtractorOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

type MessageHistory = Array<{ role: 'user' | 'assistant'; content: string }>;

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  output_text?: string[];
}

export class LLMEntityExtractor {
  private options: LLMEntityExtractorOptions;
  private fetch: FetchLike | undefined;

  constructor(options: LLMEntityExtractorOptions = {}) {
    this.options = options;
    this.fetch = typeof fetch === 'function' ? (fetch as FetchLike) : undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey() && this.fetch);
  }

  async extract(history: MessageHistory, role: RolePreset): Promise<LLMEntityExtraction | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const apiKey = this.getApiKey();
    const baseUrl = this.options.baseUrl ?? process.env.DIAGRAM_LLM_BASE_URL ?? 'https://api.openai.com/v1';
    const model = this.options.model ?? process.env.DIAGRAM_LLM_MODEL ?? 'gpt-4o-mini';
    const url = `${baseUrl.replace(/\/$/, '')}/responses`;

    const systemPrompt = [
      'You translate chat history into diagram inputs.',
      'Return strict JSON with fields: entities (array of concise node labels) and diagramType ("mermaid" or "mindmap").',
      'Prefer mermaid for procedural or sequential flows and mindmap for brainstorming or hierarchies.',
      'Never include any additional text.',
    ].join(' ');

    const transcript = history
      .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`)
      .join('\n');

    try {
      const response = await this.fetch!(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                `Session role: ${role}.`,
                'Derive diagram inputs from the following transcript:',
                transcript,
              ].join('\n'),
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'diagram_entities',
              schema: {
                type: 'object',
                required: ['entities'],
                properties: {
                  entities: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Ordered list of diagram node labels.',
                  },
                  diagramType: {
                    type: 'string',
                    enum: ['mermaid', 'mindmap'],
                  },
                },
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as OpenAIResponse;
      const text = this.extractText(payload);
      if (!text) {
        throw new Error('Missing response text from LLM');
      }
      const parsed = JSON.parse(text) as LLMEntityExtraction;
      const entities = Array.isArray(parsed.entities) ? parsed.entities.filter((item) => typeof item === 'string') : [];
      const diagramType = parsed.diagramType === 'mermaid' || parsed.diagramType === 'mindmap' ? parsed.diagramType : undefined;
      if (entities.length === 0) {
        return null;
      }
      return { entities, diagramType };
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('LLM extraction failed:', error);
      }
      return null;
    }
  }

  private extractText(response: OpenAIResponse): string | null {
    const fromChoices = response.choices?.[0]?.message?.content;
    if (fromChoices) {
      return fromChoices;
    }
    const fromOutput = response.output_text?.[0];
    if (fromOutput) {
      return fromOutput;
    }
    return null;
  }

  private getApiKey(): string | undefined {
    return this.options.apiKey ?? process.env.DIAGRAM_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  }
}
