import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PublicPolicyBundleSchema } from '../src/schemas/public-policy.js';

describe('versioned public Ryde policy profile', () => {
  const policy = PublicPolicyBundleSchema.parse(JSON.parse(readFileSync(resolve(process.cwd(),'../data/policies/ryde-public-2026-10-07-v1.json'),'utf8')));

  it('keeps public rules sourced and separate from organizer/demo namespaces', () => {
    expect(policy.profile_id).toBe('ryde-public-2026-10-07-v1');
    expect(policy.rules.every((rule)=>rule.namespace==='official_rule')).toBe(true);
    expect(policy.rules.some((rule)=>rule.id.startsWith('ORG-')||rule.id.startsWith('DEMO-'))).toBe(false);
  });

  it('encodes the published 661-cent amount and strict greater-than 180-second condition', () => {
    const rule=policy.rules.find((item)=>item.id==='PUB-NS-02');
    expect(rule?.parameters).toMatchObject({amount_minor:661,wait_seconds:180,comparison:'strictly_greater_than'});
    expect(policy.unsupported_services).toContain('RydeTAXI');
    expect(policy.limitations.join(' ')).toContain('early-arrival');
  });
});
