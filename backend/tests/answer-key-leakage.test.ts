import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDisp002Fixture } from '../src/fixtures/loader.js';
import { projectCaseEvidence } from '../src/projections/case-projection.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '../..');

// Terms that should NEVER appear in runtime code or API responses.
const FORBIDDEN_TERMS = [
  'UPHELD',
  'Expected ruling',
  'Evidence Summary',
  'expected_ruling',
  'expectedDisposition',
];

describe('Answer-key leakage prevention', () => {
  it('data/fixtures/disp-002.json does not contain the expected ruling label', () => {
    const content = readFileSync(resolve(ROOT, 'data/fixtures/disp-002.json'), 'utf-8');
    // "UPHELD" as a standalone ruling label or in the phrase "Expected ruling"
    expect(content).not.toMatch(/Cancellation charge UPHELD/i);
    expect(content).not.toMatch(/Expected ruling/i);
    // The word "upheld" may appear in dispute_history fields as evidence data;
    // that is not answer-key leakage.
  });

  it('data/fixtures/disp-002.json does not contain "Expected ruling"', () => {
    const content = readFileSync(resolve(ROOT, 'data/fixtures/disp-002.json'), 'utf-8');
    expect(content).not.toMatch(/Expected ruling/i);
  });

  it('data/fixtures/disp-002.json does not contain "Evidence Summary"', () => {
    const content = readFileSync(resolve(ROOT, 'data/fixtures/disp-002.json'), 'utf-8');
    expect(content).not.toMatch(/Evidence Summary/i);
  });

  it('data/fixtures/disp-002.json does not contain editorial summary fields', () => {
    const content = readFileSync(resolve(ROOT, 'data/fixtures/disp-002.json'), 'utf-8');
    expect(content).not.toMatch(/expected_ruling|expected_label|answer_key/i);
  });

  it('data/policies/organizer-disp002-v1.json does not contain expected ruling', () => {
    const content = readFileSync(resolve(ROOT, 'data/policies/organizer-disp002-v1.json'), 'utf-8');
    expect(content).not.toMatch(/UPHELD|claim_rejected|Expected ruling/i);
  });

  it('no runtime source file imports from eval/expectations', () => {
    function scanDir(dir: string): string[] {
      if (!existsSync(dir)) return [];
      const results: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanDir(full));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
          const content = readFileSync(full, 'utf-8');
          if (content.includes('eval/expectations') || content.includes('expectations/')) {
            results.push(full);
          }
        }
      }
      return results;
    }

    const offenders = scanDir(resolve(ROOT, 'backend/src'));
    expect(offenders).toEqual([]);
  });

  it('no runtime source file references answer-key fields or imports', () => {
    function scanDir(dir: string): string[] {
      if (!existsSync(dir)) return [];
      const results: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanDir(full));
        } else if (entry.name.endsWith('.ts')) {
          const content = readFileSync(full, 'utf-8');
          if (
            content.match(/expected_ruling|expectedDisposition/i) ||
            content.match(/from.*eval\/expectations/)
          ) {
            results.push(full);
          }
        }
      }
      return results;
    }

    const offenders = scanDir(resolve(ROOT, 'backend/src'));
    expect(offenders).toEqual([]);
  });

  it('safe case projection response does not contain answer-key data', () => {
    const fixture = loadDisp002Fixture();
    const projection = projectCaseEvidence(fixture);
    const serialized = JSON.stringify(projection);

    for (const term of FORBIDDEN_TERMS) {
      expect(serialized).not.toContain(term);
    }
  });

  it('safe case projection does not expose historical profile fields', () => {
    const fixture = loadDisp002Fixture();
    const projection = projectCaseEvidence(fixture);
    const serialized = JSON.stringify(projection);

    // Structured profile fields must not appear as response keys.
    expect(serialized).not.toContain('avg_rating');
    expect(serialized).not.toContain('dispute_history');
    expect(serialized).not.toContain('fraud_flags');
    expect(serialized).not.toContain('fraud_flag_details');
    expect(serialized).not.toContain('account_age_days');
    expect(serialized).not.toContain('total_trips');
    expect(serialized).not.toContain('payment_method');
    // Names and vehicle may appear in evidence text (e.g. app event details),
    // but must not appear as structured profile fields. Check that no
    // rider_profile or driver_profile object is in the projection.
    expect(serialized).not.toContain('rider_profile');
    expect(serialized).not.toContain('driver_profile');
  });

  it('eval/expectations/disp-002.json exists and contains the expected ruling', () => {
    const evalPath = resolve(ROOT, 'eval/expectations/disp-002.json');
    expect(existsSync(evalPath)).toBe(true);
    const content = readFileSync(evalPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.expectedDisposition).toBe('claim_rejected');
    expect(parsed.expectedFeeTreatment).toBe('upheld');
    expect(parsed.expectedWaitSeconds).toBe(480);
  });
});
