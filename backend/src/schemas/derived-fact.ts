import { z } from 'zod';

// ---------------------------------------------------------------------------
// DerivedFact schema — based on SRS section 11.2 / EVD-04.
// Derived facts carry input evidence IDs, calculation name/version,
// value/unit, and quality warnings.
// ---------------------------------------------------------------------------

export const DerivedFactSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  unit: z.string().nullable(),
  sourceEvidenceIds: z.array(z.string()),
  calculationVersion: z.string(),
  policyRuleIds: z.array(z.string()),
  status: z.enum(['established', 'uncertain', 'not_applicable']),
  warnings: z.array(z.string()),
});

export type DerivedFact = z.infer<typeof DerivedFactSchema>;
