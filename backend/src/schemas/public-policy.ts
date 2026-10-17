import { z } from 'zod';

export const PublicPolicyBundleSchema = z.object({
  profile_id: z.literal('ryde-public-2026-10-07-v1'), version: z.string(), retrieved_at: z.string(),
  automatic_scope: z.array(z.string()).min(1), unsupported_services: z.array(z.string()),
  rules: z.array(z.object({ id:z.string(), namespace:z.literal('official_rule'), statement:z.string(), source_ids:z.array(z.string()).min(1), parameters:z.record(z.union([z.string(),z.number(),z.boolean()])) }).strict()).min(1),
  limitations: z.array(z.string()).min(1),
}).strict();
