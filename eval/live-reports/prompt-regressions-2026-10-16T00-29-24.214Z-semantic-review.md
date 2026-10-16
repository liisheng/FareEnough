# Isolated Judge delivery diagnostic

Source: [raw report](prompt-regressions-2026-10-16T00-29-24.214Z.json).

One authorized `judge-missing-input` request, with no concurrent evaluation batch and no automatic retry. Repository prompts and ADP settings were unchanged. The only code difference was evaluation-only diagnostic metadata, verified by 54 targeted local tests.

The response passed the machine checks and semantic inspection: it requests identified case evidence, identified policy, both briefs and rebuttals, and required verified calculations. It does not invent citations, choose a fee outcome, or interpret missing input as an invalid claim. It uses plain language as required.

The stream contained a successful acknowledgment, response events, one completed assistant reply, and the end marker. No upstream error code was reported. Correlation identifiers and bounded event timings are retained in the raw report; credentials, echoed input and private reasoning are excluded from diagnostic metadata.

This establishes delivery and correct handling of this one missing-input request. It does not prove that batch concurrency caused earlier missing responses, that the service is consistently reliable, or that any full sample/regression suite now passes. Earlier failures remain unchanged.
