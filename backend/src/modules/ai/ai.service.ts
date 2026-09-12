import OpenAI from 'openai';

import { env } from '../../config/env';
import { logger } from '../../logger';
import { ApiError } from '../../utils/ApiError';
import { generateLocalSummary } from './localSummary';

let client: OpenAI | null = null;
let lastApiKey: string | undefined = undefined;
let lastBaseUrl: string | undefined = undefined;

export function resetClient(): void {
  client = null;
  lastApiKey = undefined;
  lastBaseUrl = undefined;
}

function getClient(): OpenAI {
  if (!env.aiApiKey) {
    throw ApiError.badRequest('AI summarization is not configured on this server');
  }
  if (!client || lastApiKey !== env.aiApiKey || lastBaseUrl !== env.aiBaseUrl) {
    client = new OpenAI({ apiKey: env.aiApiKey, baseURL: env.aiBaseUrl });
    lastApiKey = env.aiApiKey;
    lastBaseUrl = env.aiBaseUrl;
  }
  return client;
}

const SYSTEM_PROMPT =
  'You summarize personal notes into 1-2 concise sentences that capture the key point and any concrete next steps. Respond with only the summary text - no headings, quotes, or commentary.';

const MAX_INPUT_CHARS = 8000;

export async function summarizeText(text: string, client?: OpenAI): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw ApiError.badRequest('This note has no content to summarize');
  }

  if (env.aiApiKey === 'local' || env.aiApiKey === 'mock') {
    return generateLocalSummary(trimmed);
  }

  const isCustomClient = client !== undefined;
  const activeClient = client ?? getClient();

  try {
    const response = await activeClient.chat.completions.create({
      model: env.aiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmed.slice(0, MAX_INPUT_CHARS) },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('Empty response from the AI provider');
    }
    return summary;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    logger.error({ err }, 'AI summarization request failed');

    if (env.aiEnableFallback && !isCustomClient) {
      logger.warn('External AI provider failed; using local extractive summary fallback');
      return generateLocalSummary(trimmed);
    }

    throw ApiError.internal('Could not generate a summary right now. Please try again.');
  }
}
