import { describe, expect, it } from 'vitest';
import { policyPrecedentsFor } from '../src/policies/ryde-precedents.js';

// The reference helper remains available for independent experiments. The
// restored focused-validation runtime does not append these references.
describe('supplied policy precedent helper', () => {
  it.each([
    ['route', '7.1', 'DISP-2026-0089'],
    ['surge', '7.2', 'DISP-2026-0142'],
    ['no_show', '7.3', 'DISP-2026-0211'],
  ] as const)('selects the relevant source precedent for %s', (category, section, historicalCase) => {
    const refs = policyPrecedentsFor(category);
    expect(refs.some(ref => ref.id === 'RYDE-V2.1-7')).toBe(true);
    expect(refs.find(ref => ref.id === `RYDE-V2.1-${section}`)?.text).toContain(historicalCase);
    expect(refs.filter(ref => /^RYDE-V2\.1-7\./.test(ref.id))).toHaveLength(1);
    expect(refs.every(ref => ref.value.includes('historical policy context, not current incident evidence'))).toBe(true);
  });

  it('labels historical facts and preserves current restrictions in its comparison guidance', () => {
    for (const category of ['route', 'surge', 'no_show'] as const) {
      const framework = policyPrecedentsFor(category).find(ref => ref.id === 'RYDE-V2.1-7');
      expect(framework?.text).toContain('not current incident evidence');
      expect(framework?.text).toContain('amount, confidence and factual findings do not transfer');
      expect(framework?.text).toContain('Current mandatory category and safety restrictions still apply');
    }
    expect(policyPrecedentsFor('route').find(ref => ref.id === 'RYDE-V2.1-7.1')?.text).toContain('does not remove the §6.2 restriction');
    expect(policyPrecedentsFor('surge').find(ref => ref.id === 'RYDE-V2.1-7.2')?.text).toContain('use the current verified amount');
  });
});
