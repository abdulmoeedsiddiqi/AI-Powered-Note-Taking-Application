import { expect } from 'chai';
import type OpenAI from 'openai';

import { env } from '../../../src/config/env';
import { summarizeText } from '../../../src/modules/ai/ai.service';

function fakeClient(create: (params: unknown) => Promise<unknown>): OpenAI {
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

describe('ai.service', () => {
  describe('summarizeText', () => {
    it('rejects empty/whitespace-only content without calling the provider', async () => {
      const client = fakeClient(() => {
        throw new Error('should not be called');
      });

      try {
        await summarizeText('   ', client);
        expect.fail('expected summarizeText to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(400);
      }
    });

    it('returns the trimmed summary text from the provider response', async () => {
      const client = fakeClient(async () => ({
        choices: [{ message: { content: '  A concise summary.  ' } }],
      }));

      const summary = await summarizeText('Some note content', client);

      expect(summary).to.equal('A concise summary.');
    });

    it('wraps a provider error into a generic 500 without leaking details', async () => {
      const client = fakeClient(async () => {
        throw new Error('rate limit exceeded: quota details you should not see');
      });

      try {
        await summarizeText('Some note content', client);
        expect.fail('expected summarizeText to throw');
      } catch (err) {
        const apiErr = err as { statusCode: number; message: string };
        expect(apiErr.statusCode).to.equal(500);
        expect(apiErr.message).to.not.include('rate limit');
      }
    });

    it('wraps an empty provider response into a generic 500', async () => {
      const client = fakeClient(async () => ({ choices: [] }));

      try {
        await summarizeText('Some note content', client);
        expect.fail('expected summarizeText to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(500);
      }
    });

    it('rejects with a clear 400 when no API key is configured and no client is injected', async () => {
      const original = env.aiApiKey;
      env.aiApiKey = undefined;

      try {
        await summarizeText('Some note content');
        expect.fail('expected summarizeText to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(400);
      } finally {
        env.aiApiKey = original;
      }
    });

    it('returns local summary when aiApiKey is configured as local or mock', async () => {
      const original = env.aiApiKey;
      env.aiApiKey = 'local';

      try {
        const summary = await summarizeText('Team agreed on the roadmap. Focus on MVP first.');
        expect(summary).to.include('Team agreed on the roadmap.');
        expect(summary).to.include('Focus on MVP first.');
      } finally {
        env.aiApiKey = original;
      }
    });

    it('uses local fallback summary when aiEnableFallback is true and provider fails', async () => {
      const originalFallback = env.aiEnableFallback;
      const originalKey = env.aiApiKey;
      env.aiEnableFallback = true;
      env.aiApiKey = 'dummy-key';

      try {
        const summary = await summarizeText('Team agreed on the roadmap. Focus on MVP first.');
        expect(summary).to.include('Team agreed on the roadmap.');
      } finally {
        env.aiEnableFallback = originalFallback;
        env.aiApiKey = originalKey;
      }
    });
  });
});
