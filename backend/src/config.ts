import { z } from 'zod';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuration — reads environment variables with safe defaults.
// Per SRS OPS-02. No secrets are surfaced.
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  APP_MODE: z.string().default('demo'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.string().default('3001'),
  DATABASE_PATH: z.string().default('.runtime/fareenough.sqlite'),
  AI_MODE: z.enum(['replay', 'live']).default('replay'),
  MODEL_PROVIDER: z.string().default('deepseek'),
  ADP_CHAT_URL: z.literal('https://wss.lke.tencentcloud.com/adp/v2/chat').default('https://wss.lke.tencentcloud.com/adp/v2/chat'),
  ADP_RIDER_APP_KEY: z.string().default(''),
  ADP_DRIVER_APP_KEY: z.string().default(''),
  ADP_JUDGE_APP_KEY: z.string().default(''),
  MODEL_CALL_TIMEOUT_MS: z.string().default('60000'),
  RUN_TIMEOUT_MS: z.string().default('240000'),
  MAX_MODEL_CALLS_PER_RUN: z.string().default('12'),
  MAX_MODEL_CALLS_PER_SESSION: z.string().default('60'),
  SESSION_SECRET: z.string().default('change-me-for-local-dev'),
  ENABLE_DEMO_RESET: z.string().default('true'),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parse environment into a validated config object. */
export function parseConfig(env: Record<string, string | undefined> = process.env): Env {
  return EnvSchema.parse({
    APP_MODE: env.APP_MODE,
    HOST: env.HOST,
    PORT: env.PORT,
    DATABASE_PATH: env.DATABASE_PATH,
    AI_MODE: env.AI_MODE,
    MODEL_PROVIDER: env.MODEL_PROVIDER,
    ADP_CHAT_URL: env.ADP_CHAT_URL,
    ADP_RIDER_APP_KEY: env.ADP_RIDER_APP_KEY,
    ADP_DRIVER_APP_KEY: env.ADP_DRIVER_APP_KEY,
    ADP_JUDGE_APP_KEY: env.ADP_JUDGE_APP_KEY,
    MODEL_CALL_TIMEOUT_MS: env.MODEL_CALL_TIMEOUT_MS,
    RUN_TIMEOUT_MS: env.RUN_TIMEOUT_MS,
    MAX_MODEL_CALLS_PER_RUN: env.MAX_MODEL_CALLS_PER_RUN,
    MAX_MODEL_CALLS_PER_SESSION: env.MAX_MODEL_CALLS_PER_SESSION,
    SESSION_SECRET: env.SESSION_SECRET,
    ENABLE_DEMO_RESET: env.ENABLE_DEMO_RESET,
  });
}

// Load .env if present (dev convenience). Wrapped in try/catch so it never
// breaks when dotenv is not installed or .env is absent.
try {
  const { config } = await import('dotenv');
  // Resolve consistently for both src/ and dist/, regardless of launch cwd.
  // Unit tests deliberately do not load local credentials.
  if (process.env.NODE_ENV !== 'test') config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
} catch {
  // dotenv not available or no .env file — proceed with process.env only.
}

export const config = parseConfig();

export const HOST: string = config.HOST;
export const PORT: number = parseInt(config.PORT, 10);
export const DATABASE_PATH: string = config.DATABASE_PATH;
export const AI_MODE: string = config.AI_MODE;

export function isAdpConfigured(env: Env = config): boolean {
  return env.AI_MODE === 'live' && env.MODEL_PROVIDER === 'adp'
    && [env.ADP_RIDER_APP_KEY, env.ADP_DRIVER_APP_KEY, env.ADP_JUDGE_APP_KEY]
      .every((key) => key.trim().length > 0);
}
