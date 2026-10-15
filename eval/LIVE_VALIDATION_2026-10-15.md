# Tencent ADP live validation - 2026-10-15

No credentials, prompts, raw provider responses, or party text are recorded here.

## Configuration

- Provider: Tencent ADP v2
- Role applications: separate Rider Advocate, Driver Advocate, and Judge AppKeys
- Calls per run: five (two briefs, two rebuttals, one Judge proposal)
- Money: simulation only

## Results

| Scenario | Runs | Five stages completed | Deterministically validated | Safe human review | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| DISP-002 organizer no-show | 3 | 3 | 1 | 2 | One `uphold_fee`/0-cent result; two conservative escalations |
| Synthetic route/ERP | 1 | 1 | 1 | 0 | `refund_unsupported_charge`; exact 325-cent simulated refund |

Total model calls: 20.

Observed no-show run times were approximately 35.5, 37.8, and 44.3 seconds. The route smoke script did not record latency. Every run returned structured outputs for all five stages. No run created a real payment.

## Release interpretation

The integration is technically working, citation/schema gates are active, and uncertain no-show outputs fail safe. However, automatic live no-show agreement was only 1/3 in this small sample. Keep `AI_MODE=replay` by default for presentation setup and enable live mode deliberately. Do not describe these four runs as statistical model evaluation or claim stable automatic no-show adjudication.

The route result was correct in its single live trial, but one run is not sufficient to claim broad stability. The deterministic backend, not the model, owns the allowed amount and final validation.
