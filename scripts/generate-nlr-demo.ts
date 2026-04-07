/**
 * Generate demo files designed to trigger each Natural Language Rule.
 * Each trade's break pattern matches exactly one (or two) explanation key rules.
 * Trade IDs encode the expected key so you can verify AI got it right.
 *
 * Run: npx tsx scripts/generate-nlr-demo.ts
 */

import * as fs from "fs"
import * as path from "path"

const OUT = path.join(process.cwd(), "demo-data", "05_nlr_assignment")
fs.mkdirSync(OUT, { recursive: true })

function r(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d
}

const header = [
  "trade_id", "portfolio", "counterparty", "typology", "asset_class",
  "currency", "notional", "trade_date", "maturity_date",
  "market_value", "past_cash", "future_cash", "settled_cash", "pnl",
  "dv01_par", "dv01_zero", "fx_delta", "eq_delta",
  "vega", "theta", "gamma"
].join(",")

interface Trade {
  src: string
  tgt: string
}

function makeTrade(
  id: string, portfolio: string, cpty: string, typo: string, ac: string,
  ccy: string, notional: number, td: string, md: string,
  mv: number, pastCash: number, futureCash: number, settledCash: number, pnl: number,
  dv01Par: number, dv01Zero: number, fxDelta: number, eqDelta: number,
  vega: number, theta: number, gamma: number
): string {
  return [id, portfolio, cpty, typo, ac, ccy, notional, td, md,
    mv, pastCash, futureCash, settledCash, pnl,
    dv01Par, dv01Zero, fxDelta, eqDelta, vega, theta, gamma].join(",")
}

const sources: string[] = []
const targets: string[] = []

// ── BOOTSTRAP_METHOD: 8 IR products, DV01 shifted 2-5%, MV proportional ──
for (let i = 1; i <= 8; i++) {
  const id = `BOOT_${String(i).padStart(3, "0")}`
  const notional = 50_000_000 + i * 10_000_000
  const dv01 = r(notional * 0.00005)
  const mv = r(notional * 0.03)
  const pnl = r(mv + 1200)

  sources.push(makeTrade(id, "FLOW_IR_EUR", "JPMORGAN", "IRS", "IR", "EUR",
    notional, "2024-03-15", "2029-03-15", mv, 1200, 3400, 1000, pnl,
    dv01, r(dv01 * 1.02), 0, 0, 0, 0, 0))

  const dv01Shift = r(dv01 * (0.025 + Math.random() * 0.025)) // 2.5-5% shift
  const mvShift = r(dv01Shift * 400)
  targets.push(makeTrade(id, "FLOW_IR_EUR", "JPMORGAN", "IRS", "IR", "EUR",
    notional, "2024-03-15", "2029-03-15", r(mv + mvShift), 1200, 3400, 1000, r(pnl + mvShift),
    r(dv01 + dv01Shift), r(dv01 * 1.02 + dv01Shift * 1.1), 0, 0, 0, 0, 0))
}

// ── VOL_SURFACE_INTERP: 6 options, vega shifted 8-15%, theta 3-8% ──
for (let i = 1; i <= 6; i++) {
  const id = `VOLS_${String(i).padStart(3, "0")}`
  const notional = 20_000_000 + i * 5_000_000
  const vega = r(notional * 0.0012)
  const theta = r(-notional * 0.0004)
  const mv = r(notional * 0.02)
  const typo = i <= 3 ? "FX_Option" : "EQ_Option"
  const ac = i <= 3 ? "FX" : "EQ"

  sources.push(makeTrade(id, `FLOW_${ac}_G10`, "GOLDMAN_SACHS", typo, ac, "USD",
    notional, "2024-06-01", "2026-06-01", mv, 500, 2000, 300, r(mv + 2500),
    0, 0, ac === "FX" ? r(notional * 0.1) : 0, ac === "EQ" ? r(notional * 0.2) : 0,
    vega, theta, r(notional * 0.00002)))

  const vegaShift = r(vega * (0.08 + Math.random() * 0.07)) // 8-15%
  const thetaShift = r(theta * (0.03 + Math.random() * 0.05)) // 3-8%
  const mvShift = r(vegaShift * 60)
  targets.push(makeTrade(id, `FLOW_${ac}_G10`, "GOLDMAN_SACHS", typo, ac, "USD",
    notional, "2024-06-01", "2026-06-01", r(mv + mvShift), 500, 2000, 300, r(mv + 2500 + mvShift),
    0, 0, ac === "FX" ? r(notional * 0.1) : 0, ac === "EQ" ? r(notional * 0.2) : 0,
    r(vega + vegaShift), r(theta + thetaShift), r(notional * 0.00002)))
}

// ── DAYCOUNT_CONV: 5 GBP IR products, tiny PnL diff (<0.01% of notional) ──
for (let i = 1; i <= 5; i++) {
  const id = `DAYC_${String(i).padStart(3, "0")}`
  const notional = 30_000_000 + i * 8_000_000
  const mv = r(notional * 0.015)
  const pnl = r(mv + 800)
  const dv01 = r(notional * 0.00004)

  sources.push(makeTrade(id, "FLOW_IR_GBP", "BARCLAYS", i <= 3 ? "IRS" : "Bond", "IR", "GBP",
    notional, "2024-01-10", "2028-01-10", mv, 800, 1500, 600, pnl,
    dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0))

  const tinyDiff = r(notional * (0.00002 + Math.random() * 0.00006)) // <0.01%
  targets.push(makeTrade(id, "FLOW_IR_GBP", "BARCLAYS", i <= 3 ? "IRS" : "Bond", "IR", "GBP",
    notional, "2024-01-10", "2028-01-10", mv, r(800 + tinyDiff), 1500, r(600 + tinyDiff * 0.5), r(pnl + tinyDiff),
    dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0))
}

// ── FX_RATE_SOURCE: 5 FX products, fx_delta shifted 0.5-2%, MV follows ──
for (let i = 1; i <= 5; i++) {
  const id = `FXRT_${String(i).padStart(3, "0")}`
  const notional = 40_000_000 + i * 12_000_000
  const fxDelta = r(notional * 0.15)
  const mv = r(notional * 0.01)

  sources.push(makeTrade(id, "FLOW_FX_G10", "HSBC", "FX_Forward", "FX", "USD",
    notional, "2024-04-20", "2025-10-20", mv, 200, 4000, 150, r(mv + 4200),
    0, 0, fxDelta, 0, 0, 0, 0))

  const deltaShift = r(fxDelta * (0.005 + Math.random() * 0.015)) // 0.5-2%
  const mvShift = r(deltaShift * 0.02)
  targets.push(makeTrade(id, "FLOW_FX_G10", "HSBC", "FX_Forward", "FX", "USD",
    notional, "2024-04-20", "2025-10-20", r(mv + mvShift), 200, 4000, 150, r(mv + 4200 + mvShift),
    0, 0, r(fxDelta + deltaShift), 0, 0, 0, 0))
}

// ── SETTLEMENT_DATE: 5 trades, settled_cash↓ = future_cash↑, MV unchanged ──
for (let i = 1; i <= 5; i++) {
  const id = `SETL_${String(i).padStart(3, "0")}`
  const notional = 25_000_000 + i * 7_000_000
  const mv = r(notional * 0.02)
  const settled = r(notional * 0.003)
  const future = r(notional * 0.008)

  sources.push(makeTrade(id, "FLOW_FX_EM", "CITIBANK", "FX_Swap", "FX", "JPY",
    notional, "2024-08-05", "2025-08-05", mv, 500, future, settled, r(mv + 500 + future),
    0, 0, r(notional * 0.08), 0, 0, 0, 0))

  const cashShift = r(notional * (0.0003 + Math.random() * 0.0004))
  targets.push(makeTrade(id, "FLOW_FX_EM", "CITIBANK", "FX_Swap", "FX", "JPY",
    notional, "2024-08-05", "2025-08-05", mv, 500, r(future + cashShift), r(settled - cashShift), r(mv + 500 + future),
    0, 0, r(notional * 0.08), 0, 0, 0, 0))
}

// ── ROUNDING_PRECISION: 6 trades, ALL diffs < $0.05, mixed products ──
for (let i = 1; i <= 6; i++) {
  const id = `RNDS_${String(i).padStart(3, "0")}`
  const typos = ["IRS", "FX_Forward", "EQ_Forward", "COM_Swap", "Bond", "Deposit"]
  const acs = ["IR", "FX", "EQ", "COM", "IR", "IR"]
  const notional = 10_000_000 + i * 5_000_000
  const mv = r(notional * 0.025)
  const dv01 = acs[i-1] === "IR" ? r(notional * 0.00003) : 0

  sources.push(makeTrade(id, "MISC_BOOK", "UBS", typos[i-1], acs[i-1], "EUR",
    notional, "2024-02-14", "2027-02-14", mv, 300, 1800, 200, r(mv + 2100),
    dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0))

  const tiny = r((Math.random() - 0.5) * 0.04) // always < $0.05
  targets.push(makeTrade(id, "MISC_BOOK", "UBS", typos[i-1], acs[i-1], "EUR",
    notional, "2024-02-14", "2027-02-14", r(mv + tiny), 300, 1800, 200, r(mv + 2100 + tiny),
    dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0))
}

// ── BARRIER_ENGINE: 4 barrier options, large MV change (>0.5% notional) + vega/theta ──
for (let i = 1; i <= 4; i++) {
  const id = `BARR_${String(i).padStart(3, "0")}`
  const typo = i <= 2 ? "FX_Barrier_Option" : "EQ_Barrier_Option"
  const ac = i <= 2 ? "FX" : "EQ"
  const notional = 15_000_000 + i * 5_000_000
  const mv = r(notional * 0.04)
  const vega = r(notional * 0.0015)
  const theta = r(-notional * 0.0005)

  sources.push(makeTrade(id, `EXOTIC_${ac}`, "NOMURA", typo, ac, "EUR",
    notional, "2024-07-01", "2026-01-01", mv, 0, 3000, 0, r(mv + 3000),
    0, 0, ac === "FX" ? r(notional * 0.12) : 0, ac === "EQ" ? r(notional * 0.25) : 0,
    vega, theta, r(notional * 0.00003)))

  const bigShift = r(notional * (0.006 + Math.random() * 0.008)) // >0.5%
  targets.push(makeTrade(id, `EXOTIC_${ac}`, "NOMURA", typo, ac, "EUR",
    notional, "2024-07-01", "2026-01-01", r(mv + bigShift), 0, 3000, 0, r(mv + 3000 + bigShift),
    0, 0, ac === "FX" ? r(notional * 0.12) : 0, ac === "EQ" ? r(notional * 0.25) : 0,
    r(vega * 1.2), r(theta * 1.15), r(notional * 0.00003)))
}

// ── CURVE_STRIPPING: 5 IR products, DV01 shifted 1-3%, zero > par shift ──
for (let i = 1; i <= 5; i++) {
  const id = `CURV_${String(i).padStart(3, "0")}`
  const notional = 60_000_000 + i * 15_000_000
  const dv01Par = r(notional * 0.00006)
  const dv01Zero = r(dv01Par * 1.04)
  const mv = r(notional * 0.02)

  sources.push(makeTrade(id, "FLOW_IR_USD", "BOFA", "IRS", "IR", "USD",
    notional, "2024-05-10", "2032-05-10", mv, 900, 2500, 700, r(mv + 3400),
    dv01Par, dv01Zero, 0, 0, 0, 0, 0))

  // Zero shifts more than par (key differentiator from BOOTSTRAP)
  const parShift = r(dv01Par * (0.01 + Math.random() * 0.02)) // 1-3%
  const zeroShift = r(parShift * (1.5 + Math.random() * 0.5)) // zero shifts 1.5-2x more
  const mvShift = r(parShift * 200)
  targets.push(makeTrade(id, "FLOW_IR_USD", "BOFA", "IRS", "IR", "USD",
    notional, "2024-05-10", "2032-05-10", r(mv + mvShift), 900, 2500, 700, r(mv + 3400 + mvShift),
    r(dv01Par + parShift), r(dv01Zero + zeroShift), 0, 0, 0, 0, 0))
}

// ── THETA_CALC: 5 options, theta shifted 5-20%, delta/vega stable ──
for (let i = 1; i <= 5; i++) {
  const id = `THET_${String(i).padStart(3, "0")}`
  const typo = i <= 3 ? "FX_Option" : "EQ_Option"
  const ac = i <= 3 ? "FX" : "EQ"
  const notional = 18_000_000 + i * 6_000_000
  const vega = r(notional * 0.001)
  const theta = r(-notional * 0.00035)
  const mv = r(notional * 0.015)

  sources.push(makeTrade(id, `VOL_${ac}`, "DEUTSCHE_BANK", typo, ac, "EUR",
    notional, "2024-09-15", "2025-09-15", mv, 100, 1500, 80, r(mv + 1600),
    0, 0, ac === "FX" ? r(notional * 0.09) : 0, ac === "EQ" ? r(notional * 0.18) : 0,
    vega, theta, r(notional * 0.00001)))

  const thetaShift = r(theta * (0.05 + Math.random() * 0.15)) // 5-20%
  const mvTiny = r(thetaShift * 10) // small MV impact
  targets.push(makeTrade(id, `VOL_${ac}`, "DEUTSCHE_BANK", typo, ac, "EUR",
    notional, "2024-09-15", "2025-09-15", r(mv + mvTiny), 100, 1500, 80, r(mv + 1600 + mvTiny),
    0, 0, ac === "FX" ? r(notional * 0.09) : 0, ac === "EQ" ? r(notional * 0.18) : 0,
    vega, r(theta + thetaShift), r(notional * 0.00001)))
}

// ── DATA_QUALITY: 3 anomalies, huge MV diff, no sensitivity correlation ──
for (let i = 1; i <= 3; i++) {
  const id = `ANOM_${String(i).padStart(3, "0")}`
  const notional = 80_000_000 + i * 20_000_000
  const mv = r(notional * 0.01)
  const dv01 = r(notional * 0.00004)

  sources.push(makeTrade(id, "EXOTIC_IR_EUR", "MIZUHO", "IRS", "IR", "CHF",
    notional, "2024-11-01", "2030-11-01", mv, 400, 5000, 350, r(mv + 5400),
    dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0))

  // Huge MV diff but DV01 unchanged — doesn't fit any pattern
  const hugeDiff = r((Math.random() > 0.5 ? 1 : -1) * (800_000 + Math.random() * 1_500_000))
  targets.push(makeTrade(id, "EXOTIC_IR_EUR", "MIZUHO", "IRS", "IR", "CHF",
    notional, "2024-11-01", "2030-11-01", r(mv + hugeDiff), 400, 5000, 350, r(mv + 5400 + hugeDiff),
    dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0))
}

// ── MULTI-KEY: 4 trades that should get TWO keys (BOOTSTRAP + DAYCOUNT) ──
for (let i = 1; i <= 4; i++) {
  const id = `MULT_${String(i).padStart(3, "0")}`
  const notional = 45_000_000 + i * 10_000_000
  const dv01 = r(notional * 0.00005)
  const mv = r(notional * 0.025)
  const pnl = r(mv + 900)

  sources.push(makeTrade(id, "FLOW_IR_GBP", "NATWEST", "IRS", "IR", "GBP",
    notional, "2024-02-20", "2027-02-20", mv, 900, 2200, 700, pnl,
    dv01, r(dv01 * 1.02), 0, 0, 0, 0, 0))

  // Both DV01 shift (bootstrap) AND small PnL/cash diff (daycount) on GBP
  const dv01Shift = r(dv01 * 0.035) // 3.5% — bootstrap
  const mvShift = r(dv01Shift * 350)
  const tinyPnl = r(notional * 0.00004) // tiny — daycount
  targets.push(makeTrade(id, "FLOW_IR_GBP", "NATWEST", "IRS", "IR", "GBP",
    notional, "2024-02-20", "2027-02-20", r(mv + mvShift), r(900 + tinyPnl), 2200, r(700 + tinyPnl * 0.5), r(pnl + mvShift + tinyPnl),
    r(dv01 + dv01Shift), r(dv01 * 1.02 + dv01Shift * 1.1), 0, 0, 0, 0, 0))
}

// ── 20 perfect matches (filler) ──
for (let i = 1; i <= 20; i++) {
  const id = `GOOD_${String(i).padStart(3, "0")}`
  const row = makeTrade(id, "FLOW_IR_EUR", "BNP_PARIBAS", "IRS", "IR", "EUR",
    30_000_000, "2024-01-01", "2028-01-01", 450000, 500, 2000, 400, 452500,
    1200, 1230, 0, 0, 0, 0, 0)
  sources.push(row)
  targets.push(row)
}

// Write files
const srcContent = header + "\n" + sources.join("\n")
const tgtContent = header + "\n" + targets.join("\n")

fs.writeFileSync(path.join(OUT, "nlr_source_MX3158.csv"), srcContent)
fs.writeFileSync(path.join(OUT, "nlr_target_MX3162.csv"), tgtContent)

// Count breaks
const breakCount = sources.length - 20 // 20 are matches
console.log(`\n✅ NLR Demo files generated in demo-data/05_nlr_assignment/\n`)
console.log(`   nlr_source_MX3158.csv  (${sources.length} trades)`)
console.log(`   nlr_target_MX3162.csv  (${targets.length} trades)`)
console.log(`   ${breakCount} breaks + 20 matches\n`)
console.log(`   Expected AI assignments:`)
console.log(`   ┌────────────────────────┬───────┬──────────────────────────────────────────┐`)
console.log(`   │ Trade IDs              │ Count │ Expected Key(s)                          │`)
console.log(`   ├────────────────────────┼───────┼──────────────────────────────────────────┤`)
console.log(`   │ BOOT_001 – BOOT_008    │   8   │ BOOTSTRAP_METHOD                         │`)
console.log(`   │ VOLS_001 – VOLS_006    │   6   │ VOL_SURFACE_INTERP                       │`)
console.log(`   │ DAYC_001 – DAYC_005    │   5   │ DAYCOUNT_CONV                            │`)
console.log(`   │ FXRT_001 – FXRT_005    │   5   │ FX_RATE_SOURCE                           │`)
console.log(`   │ SETL_001 – SETL_005    │   5   │ SETTLEMENT_DATE                          │`)
console.log(`   │ RNDS_001 – RNDS_006    │   6   │ ROUNDING_PRECISION                       │`)
console.log(`   │ BARR_001 – BARR_004    │   4   │ BARRIER_ENGINE                           │`)
console.log(`   │ CURV_001 – CURV_005    │   5   │ CURVE_STRIPPING                          │`)
console.log(`   │ THET_001 – THET_005    │   5   │ THETA_CALC                               │`)
console.log(`   │ ANOM_001 – ANOM_003    │   3   │ DATA_QUALITY                             │`)
console.log(`   │ MULT_001 – MULT_004    │   4   │ BOOTSTRAP_METHOD + DAYCOUNT_CONV (both!) │`)
console.log(`   │ GOOD_001 – GOOD_020    │  20   │ (perfect match, no key)                  │`)
console.log(`   └────────────────────────┴───────┴──────────────────────────────────────────┘`)
console.log(`\n   Total: ${sources.length} trades, ${breakCount} breaks\n`)
console.log(`   Demo flow:`)
console.log(`   1. Open "AI Demo — MX Upgrade Recon" project`)
console.log(`   2. Definitions → New Recon Template`)
console.log(`   3. Upload nlr_source_MX3158.csv (Source A) and nlr_target_MX3162.csv (Source B)`)
console.log(`   4. Auto-detect columns, mark trade_id as key`)
console.log(`   5. Name: "NLR Assignment Demo", Category: Core, Save`)
console.log(`   6. Run Now with the uploaded files`)
console.log(`   7. On results page: all 56 breaks are UNASSIGNED`)
console.log(`   8. Click "AI Assign by Rules"`)
console.log(`   9. AI reads the 10 natural language rules and assigns keys:`)
console.log(`      - BOOT trades → BOOTSTRAP_METHOD`)
console.log(`      - VOLS trades → VOL_SURFACE_INTERP`)
console.log(`      - MULT trades → BOTH keys (multi-key!)`)
console.log(`      - ANOM trades → DATA_QUALITY`)
console.log(`   10. Verify trade IDs match expected keys above\n`)

fs.writeFileSync(path.join(OUT, "README.md"), `# Demo 5: Natural Language Rule Assignment

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
3. Upload both files, auto-detect columns, mark \`trade_id\` as key
4. Name it "NLR Assignment Demo", save
5. **Run Now** with the files
6. Results: all 56 breaks show UNASSIGNED
7. Click **"AI Assign by Rules"**
8. AI reads the natural language rules and assigns keys
9. Verify: BOOT trades → BOOTSTRAP_METHOD, MULT trades → both keys, etc.
10. The MULT trades demonstrate multi-key assignment
`)
