# Preserved experiment after the passing checkpoint

The user selected the earlier checkpoint documented in `eval/live-reports/focused-prompt-validation-2026-10-16.md`: twelve prompt regression checks and three sample final decisions passed, while intermediate reasoning defects remained.

The active prompts, model-input projections and sample expectations were restored from that checkpoint's immutable reports. The twelve regression inputs and expected assertions were not changed. The files in this directory preserve later projection experiments and stricter citation requirements so the rollback does not erase that work. They are not loaded into the restored runtime.

`ryde-v21-suite.json` here includes later requirements for supplied policy precedents and supporting citations at every route stage. Active unit tests still verify the strict evaluation helper against this experimental contract. The restored runtime does not supply the added precedent rules, so that contract must not be represented as the baseline's passing acceptance criterion.

The general stage/schema checks and semantic-audit tools remain available. A restored 12/12 regression result and 3/3 final decisions do not claim that all intermediate arguments are correct. Earlier failed reports and their audits remain preserved.
