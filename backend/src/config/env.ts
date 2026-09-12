import dotenv from 'dotenv';

dotenv.config();

interface Env {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  logLevel: string;
  jwtSecret: string;
  jwtExpiresInDays: number;
  cookieName: string;
  // Provider-agnostic: any OpenAI-compatible chat completions API works here
  // (OpenAI, Groq, Gemini, ...) - override all three to switch providers.
  aiApiKey: string | undefined;
  aiBaseUrl: string;
  aiModel: string;
  aiEnableFallback: boolean;
}

export const env: Env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
  jwtExpiresInDays: Number(process.env.JWT_EXPIRES_IN_DAYS ?? 7),
  cookieName: process.env.COOKIE_NAME ?? 'auth_token',
  aiApiKey: process.env.AI_API_KEY,
  aiBaseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
  aiEnableFallback: process.env.AI_ENABLE_FALLBACK === 'true',
};
