import { z } from 'zod';

// ---------------------------------------------------------------------------
// Configuration — reads environment variables with safe defaults.
// Per SRS OPS-02. No secrets are surfaced.
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  APP_MODE: z.string().default('demo'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.string().default('3001'),
  DATABASE_PATH: z.string().default('.runtime/fareenough.sqlite'),
  AI_MODE: z.string().default('replay'),
  MODEL_PROVIDER: z.string().default('deepseek'),
  MODEL_CALL_TIMEOUT_MS: z.string().default('60000'),
  RUN_TIMEOUT_MS: z.string().default('240000'),
  MAX_MODEL_CALLS_PER_RUN: z.string().default('12'),
  MAX_INPUT_TOKENS_PER_RUN: z.string().default('100000'),
  MAX_OUTPUT_TOKENS_PER_RUN: z.string().default('24000'),
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
    MODEL_CALL_TIMEOUT_MS: env.MODEL_CALL_TIMEOUT_MS,
    RUN_TIMEOUT_MS: env.RUN_TIMEOUT_MS,
    MAX_MODEL_CALLS_PER_RUN: env.MAX_MODEL_CALLS_PER_RUN,
    MAX_INPUT_TOKENS_PER_RUN: env.MAX_INPUT_TOKENS_PER_RUN,
    MAX_OUTPUT_TOKENS_PER_RUN: env.MAX_OUTPUT_TOKENS_PER_RUN,
    MAX_MODEL_CALLS_PER_SESSION: env.MAX_MODEL_CALLS_PER_SESSION,
    SESSION_SECRET: env.SESSION_SECRET,
    ENABLE_DEMO_RESET: env.ENABLE_DEMO_RESET,
  });
}

// Load .env if present (dev convenience). Wrapped in try/catch so it never
// breaks when dotenv is not installed or .env is absent.
try {
  const { config } = await import('dotenv');
  config();
} catch {
  // dotenv not available or no .env file — proceed with process.env only.
}

export const config = parseConfig();

export const HOST: string = config.HOST;
export const PORT: number = parseInt(config.PORT, 10);
export const DATABASE_PATH: string = config.DATABASE_PATH;
export const AI_MODE: string = config.AI_MODE;
