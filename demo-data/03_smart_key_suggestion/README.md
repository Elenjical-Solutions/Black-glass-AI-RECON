# Demo 3: Smart Explanation Key Suggestion per Row

## Scenario
50 trades where each break has a specific "fingerprint" that AI should recognize
and suggest the correct explanation key with confidence %.

| Trade IDs | Break Pattern | AI Should Suggest | Fingerprint |
|-----------|--------------|-------------------|-------------|
| BOOT001-010 | DV01 +3%, MV proportional | BOOTSTRAP_METHOD (95%) | DV01 shifts on IR, MV follows |
| VOLS001-008 | Vega +10%, theta +5% | VOL_SURFACE_INTERP (90%) | Greek shifts on options only |
| SETL001-007 | Cash timing: settled↓ future↑ | SETTLEMENT_DATE (88%) | Zero-sum cash shift |
| DAYC001-005 | Tiny PnL diff, GBP only | DAYCOUNT_CONV (85%) | GBP + small accrual diff |
| RNDS001-005 | $0.01 diffs only | ROUNDING_PRECISION (98%) | Sub-cent, all fields |
| BARR001-005 | Large MV + vega/theta shift | BARRIER_ENGINE (82%) | Barrier option + big MV |
| GOOD001-010 | Perfect match | N/A | N/A |

## How to Demo
1. Upload files, create definition, run recon
2. On the results page, select a break row (e.g., BOOT001)
3. Click **"AI Suggest Key"** on that row
4. AI analyzes the field diffs and suggests "BOOTSTRAP_METHOD (95% confidence)"
5. Compare: select BARR001 → AI suggests "BARRIER_ENGINE (82% confidence)"
