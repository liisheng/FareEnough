import type { PolicyRule } from '../tools/case-evidence-tools.js';

// Extracted from the user-supplied Policy v2.1 §7 and Appendix A, not from
// fixture expected rulings. These are policy references, never incident facts.
const reference = (section: string, text: string): PolicyRule => ({
  id: `RYDE-V2.1-${section}`,
  text,
  value: `Policy v2.1 ${section}: historical policy context, not current incident evidence`,
});

export function policyPrecedentsFor(category: 'no_show' | 'surge' | 'route'): PolicyRule[] {
  const framework = reference('7', 'Relevant supplied precedents should be referenced for consistency, comparing their key facts with the current case. A historical ruling is policy context, not current incident evidence. Its amount, confidence and factual findings do not transfer to this case. Current mandatory category and safety restrictions still apply.');
  const precedent = category === 'route'
    ? reference('7.1', 'Historical precedent DISP-2026-0089: a traffic-justified route deviation of 1.8 km without rider notification received a partial refund of excess distance fare under §1.2, not the entire fare. The recorded historical refund was S$3.20 and confidence was 91%. Compare the current notification evidence and deviation distance; this precedent does not remove the §6.2 restriction for deviations above 2 km.')
    : category === 'surge'
      ? reference('7.2', 'Historical precedent DISP-2026-0142: surge increased from 1.0x to 1.4x between quote and pickup without notification. The quote was S$9.50 and actual fare S$12.70; the S$3.20 difference was entirely surge-related and was refunded under §3.3. Historical confidence was 96%. Apply the notification and sole-surge-difference principle to the current records; use the current verified amount, not the historical amount.')
      : reference('7.3', 'Historical precedent DISP-2026-0211: the driver waited six minutes and cancelled for no-show but sent zero messages and made zero calls before cancellation. The S$5 fee was voided under §2.3 for failure to attempt both contacts; the rider arrived one minute after cancellation. Historical confidence was 98%. Compare the current contact records: a case with the required chat and call attempts does not share that contact-failure basis.');
  const glossary = category === 'no_show'
    ? [reference('A-NO-SHOW', 'Glossary definition: no-show is a cancellation initiated by the driver after the free wait period because the rider did not appear at the pickup location. A recorded cancellation reason and party accounts must remain attributed; the definition does not prescribe independent rider GPS verification.')]
    : [];
  return [framework, precedent, ...glossary];
}
