# Demo 5: Natural Language Rule Assignment

## Scenario
76 trades (56 breaks + 20 matches). Each break is crafted to match exactly
one of the 10 natural language rules on the explanation keys.
4 trades (MULT_001-004) are designed to match TWO rules simultaneously.

## Expected AI Assignments

| Trade IDs | Count | Expected Key(s) |
|-----------|-------|-----------------|
| BOOT_001–008 | 8 | BOOTSTRAP_METHOD — DV01 shifted 2-5%, MV proportional, IR products |
| VOLS_001–006 | 6 | VOL_SURFACE_INTERP — vega shifted 8-15%, theta 3-8%, options |
| DAYC_001–005 | 5 | DAYCOUNT_CONV — tiny PnL diff, GBP only |
| FXRT_001–005 | 5 | FX_RATE_SOURCE — FX delta shifted 0.5-2%, FX products |
| SETL_001–005 | 5 | SETTLEMENT_DATE — zero-sum cash shift, MV unchanged |
| RNDS_001–006 | 6 | ROUNDING_PRECISION — all diffs < $0.05 |
| BARR_001–004 | 4 | BARRIER_ENGINE — barrier options, large MV + vega/theta shift |
| CURV_001–005 | 5 | CURVE_STRIPPING — DV01 1-3%, zero shifts more than par |
| THET_001–005 | 5 | THETA_CALC — theta 5-20% shift, delta/vega stable |
| ANOM_001–003 | 3 | DATA_QUALITY — huge MV diff, no sensitivity correlation |
| **MULT_001–004** | **4** | **BOOTSTRAP_METHOD + DAYCOUNT_CONV (both!)** |
| GOOD_001–020 | 20 | (perfect match) |

## How to Demo

1. Open **"AI Demo — MX Upgrade Recon"** project
2. Go to Definitions → New Recon Template
3. Upload both files, auto-detect columns, mark `trade_id` as key
4. Name it "NLR Assignment Demo", save
5. **Run Now** with the files
6. Results: all 56 breaks show UNASSIGNED
7. Click **"AI Assign by Rules"**
8. AI reads the natural language rules and assigns keys
9. Verify: BOOT trades → BOOTSTRAP_METHOD, MULT trades → both keys, etc.
10. The MULT trades demonstrate multi-key assignment
