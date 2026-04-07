/**
 * Generate demo data folders for 4 AI feature demonstrations.
 * Each folder is a self-contained scenario with realistic data
 * designed to showcase a specific AI capability.
 *
 * Run: npx tsx scripts/generate-demo-data.ts
 */

import * as fs from "fs"
import * as path from "path"

const BASE = path.join(process.cwd(), "demo-data")

function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function writeCSV(filePath: string, header: string, rows: string[]) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, header + "\n" + rows.join("\n"))
  console.log(`  ${path.relative(BASE, filePath).padEnd(65)} ${rows.length} rows`)
}

// ═══════════════════════════════════════════════════════════════════════
// DEMO 1: AI Break Pattern Analyst
// ═══════════════════════════════════════════════════════════════════════
// Scenario: 500 trades, ~100 breaks with CLEAR CLUSTERED PATTERNS
// that AI should identify: bootstrap diffs on IR, vol surface on options,
// rounding on everything, plus a few anomalies.

function demo1_BreakPatternAnalyst() {
  console.log("\n📊 Demo 1: AI Break Pattern Analyst")
  console.log("  Scenario: 500 trades, ~100 breaks with clustered patterns\n")

  const dir = path.join(BASE, "01_break_pattern_analyst")
  const header = "trade_id,portfolio,counterparty,typology,asset_class,currency,notional,trade_date,maturity_date,market_value,past_cash,future_cash,settled_cash,pnl,dv01_par,dv01_zero,eq_delta,fx_delta,vega"

  const sourceRows: string[] = []
  const targetRows: string[] = []

  const trades = [
    // Cluster 1: 30 IRS trades — bootstrap methodology shift (DV01 changes ~3%, MV proportional)
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `MX${String(i + 1).padStart(5, "0")}`,
      portfolio: pick(["FLOW_IR_EUR", "FLOW_IR_USD", "FLOW_IR_GBP"]),
      cpty: pick(["JPMORGAN", "BARCLAYS", "HSBC"]),
      typo: "IRS", ac: "IR",
      ccy: pick(["EUR", "USD", "GBP"]),
      notional: round(10_000_000 + Math.random() * 200_000_000, 0),
      breakType: "bootstrap"
    })),
    // Cluster 2: 20 FX/EQ options — vol surface interpolation (vega shifts 8-15%)
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `MX${String(31 + i).padStart(5, "0")}`,
      portfolio: pick(["FLOW_FX_G10", "EQ_VOL_EU"]),
      cpty: pick(["GOLDMAN_SACHS", "CITIBANK", "UBS"]),
      typo: pick(["FX_Option", "EQ_Option", "FX_Barrier_Option"]),
      ac: pick(["FX", "EQ"]),
      ccy: pick(["EUR", "USD"]),
      notional: round(5_000_000 + Math.random() * 50_000_000, 0),
      breakType: "vol_surface"
    })),
    // Cluster 3: 15 trades — day count convention (small PnL/cash diffs on GBP)
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `MX${String(51 + i).padStart(5, "0")}`,
      portfolio: pick(["FLOW_IR_GBP", "FLOW_IR_EUR"]),
      cpty: pick(["BARCLAYS", "NATWEST", "HSBC"]),
      typo: pick(["IRS", "Bond", "Bond_Forward"]),
      ac: "IR", ccy: "GBP",
      notional: round(5_000_000 + Math.random() * 100_000_000, 0),
      breakType: "daycount"
    })),
    // Cluster 4: 25 trades — pure rounding (sub-cent diffs everywhere)
    ...Array.from({ length: 25 }, (_, i) => ({
      id: `MX${String(66 + i).padStart(5, "0")}`,
      portfolio: pick(["FLOW_IR_EUR", "FLOW_FX_G10", "EQ_DELTA1_EU", "COM_ENERGY"]),
      cpty: pick(["JPMORGAN", "DEUTSCHE_BANK", "BNP_PARIBAS"]),
      typo: pick(["IRS", "FX_Forward", "EQ_Forward", "COM_Swap"]),
      ac: pick(["IR", "FX", "EQ", "COM"]),
      ccy: pick(["EUR", "USD", "GBP"]),
      notional: round(1_000_000 + Math.random() * 50_000_000, 0),
      breakType: "rounding"
    })),
    // ANOMALIES: 5 trades with huge MV diffs that don't fit any pattern
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `MX${String(91 + i).padStart(5, "0")}`,
      portfolio: pick(["EXOTIC_IR_EUR", "FLOW_FX_EM"]),
      cpty: pick(["NOMURA", "MIZUHO"]),
      typo: pick(["IRS", "FX_Swap"]),
      ac: pick(["IR", "FX"]),
      ccy: pick(["JPY", "CHF"]),
      notional: round(50_000_000 + Math.random() * 200_000_000, 0),
      breakType: "anomaly"
    })),
    // 405 perfectly matching trades (filler)
    ...Array.from({ length: 405 }, (_, i) => ({
      id: `MX${String(96 + i).padStart(5, "0")}`,
      portfolio: pick(["FLOW_IR_EUR", "FLOW_IR_USD", "FLOW_FX_G10", "EQ_DELTA1_EU", "COM_ENERGY"]),
      cpty: pick(["JPMORGAN", "BARCLAYS", "HSBC", "UBS", "CITIBANK"]),
      typo: pick(["IRS", "FX_Forward", "EQ_Option", "COM_Swap", "Bond", "Deposit"]),
      ac: pick(["IR", "FX", "EQ", "COM"]),
      ccy: pick(["EUR", "USD", "GBP"]),
      notional: round(1_000_000 + Math.random() * 100_000_000, 0),
      breakType: "match"
    })),
  ]

  for (const t of trades) {
    const mv = round(t.notional * (Math.random() - 0.3) * 0.1)
    const pastCash = round(t.notional * Math.random() * 0.003)
    const futureCash = round(t.notional * (Math.random() * 0.02 - 0.01))
    const settledCash = round(t.notional * (Math.random() * 0.005))
    const pnl = round(mv + pastCash + futureCash)
    const dv01Par = t.ac === "IR" ? round(t.notional * (Math.random() * 0.00008 - 0.00004)) : 0
    const dv01Zero = t.ac === "IR" ? round(dv01Par * 1.03) : 0
    const eqDelta = t.ac === "EQ" ? round(t.notional * (Math.random() * 0.5 - 0.25)) : 0
    const fxDelta = t.ac === "FX" ? round(t.notional * (Math.random() * 0.3 - 0.15)) : 0
    const vega = (t.typo.includes("Option") || t.typo.includes("Barrier")) ? round(t.notional * Math.random() * 0.002) : 0
    const td = `2024-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-15`
    const md = `2027-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-15`

    const src = `${t.id},${t.portfolio},${t.cpty},${t.typo},${t.ac},${t.ccy},${t.notional},${td},${md},${mv},${pastCash},${futureCash},${settledCash},${pnl},${dv01Par},${dv01Zero},${eqDelta},${fxDelta},${vega}`
    sourceRows.push(src)

    if (t.breakType === "bootstrap") {
      const dv01Shift = round(dv01Par * (0.02 + Math.random() * 0.03)) // 2-5% shift
      const mvShift = round(t.notional * dv01Shift * 0.01)
      targetRows.push(`${t.id},${t.portfolio},${t.cpty},${t.typo},${t.ac},${t.ccy},${t.notional},${td},${md},${round(mv + mvShift)},${pastCash},${futureCash},${settledCash},${round(pnl + mvShift)},${round(dv01Par + dv01Shift)},${round(dv01Zero + dv01Shift * 1.1)},${eqDelta},${fxDelta},${vega}`)
    } else if (t.breakType === "vol_surface") {
      const vegaShift = round(vega * (0.08 + Math.random() * 0.07)) // 8-15% shift
      const mvShift = round(vegaShift * 100)
      targetRows.push(`${t.id},${t.portfolio},${t.cpty},${t.typo},${t.ac},${t.ccy},${t.notional},${td},${md},${round(mv + mvShift)},${pastCash},${futureCash},${settledCash},${round(pnl + mvShift)},${dv01Par},${dv01Zero},${eqDelta},${fxDelta},${round(vega + vegaShift)}`)
    } else if (t.breakType === "daycount") {
      const cashShift = round(t.notional * (Math.random() * 0.00005 + 0.00002))
      targetRows.push(`${t.id},${t.portfolio},${t.cpty},${t.typo},${t.ac},${t.ccy},${t.notional},${td},${md},${mv},${round(pastCash + cashShift)},${futureCash},${round(settledCash + cashShift * 0.5)},${round(pnl + cashShift)},${dv01Par},${dv01Zero},${eqDelta},${fxDelta},${vega}`)
    } else if (t.breakType === "rounding") {
      const tiny = round((Math.random() - 0.5) * 0.04)
      targetRows.push(`${t.id},${t.portfolio},${t.cpty},${t.typo},${t.ac},${t.ccy},${t.notional},${td},${md},${round(mv + tiny)},${pastCash},${futureCash},${settledCash},${round(pnl + tiny)},${dv01Par},${dv01Zero},${eqDelta},${fxDelta},${vega}`)
    } else if (t.breakType === "anomaly") {
      // Huge unexplained diff — no sensitivity correlation
      const bigShift = round((Math.random() > 0.5 ? 1 : -1) * (500_000 + Math.random() * 2_000_000))
      targetRows.push(`${t.id},${t.portfolio},${t.cpty},${t.typo},${t.ac},${t.ccy},${t.notional},${td},${md},${round(mv + bigShift)},${pastCash},${futureCash},${settledCash},${round(pnl + bigShift)},${dv01Par},${dv01Zero},${eqDelta},${fxDelta},${vega}`)
    } else {
      targetRows.push(src)
    }
  }

  writeCSV(path.join(dir, "source_MX3158.csv"), header, sourceRows)
  writeCSV(path.join(dir, "target_MX3162.csv"), header, targetRows)
  fs.writeFileSync(path.join(dir, "README.md"), `# Demo 1: AI Break Pattern Analyst

## Scenario
500 trades compared between MX 3.1.58 and MX 3.1.62.
~95 breaks with **clear clustered patterns** that AI should identify:

| Cluster | Count | Pattern | What AI Should Detect |
|---------|-------|---------|----------------------|
| Bootstrap Methodology | 30 | DV01 shifts 2-5% on IR products, MV proportional | "IR curve bootstrapping change" |
| Vol Surface Interpolation | 20 | Vega shifts 8-15% on FX/EQ options, MV follows | "Volatility surface model change" |
| Day Count Convention | 15 | Small cash/P&L diffs, all GBP products | "ACT/365.25→ACT/365F for GBP" |
| Rounding Precision | 25 | Sub-cent diffs (<$0.04) across all products | "Precision increase from 8→12 dp" |
| **Anomalies** | 5 | MV diffs >$500K, NO sensitivity correlation | "Possible data quality issue" |
| Perfect Matches | 405 | Zero differences | N/A |

## How to Demo
1. Upload both files to a project
2. Create a "Core Trade Recon" definition
3. Run the reconciliation
4. Click **"AI Break Analysis"** on the results page
5. AI should identify all 4 clusters + flag the 5 anomalies
6. Click **"Apply AI Suggestions"** to auto-assign explanation keys
`)
}

// ═══════════════════════════════════════════════════════════════════════
// DEMO 2: AI Field Mapping (Different Column Names)
// ═══════════════════════════════════════════════════════════════════════
// Two files with COMPLETELY DIFFERENT column names but same data.
// AI must use financial domain knowledge to map them.

function demo2_AIFieldMapping() {
  console.log("\n🔗 Demo 2: AI Field Mapping (Different Column Names)")
  console.log("  Scenario: Same data, completely different column names\n")

  const dir = path.join(BASE, "02_ai_field_mapping")

  // Source: Murex-style naming
  const headerA = "TradeRef,Book,Counterparty_Code,Instrument_Type,Ccy,Nominal,MtM_Value,Settled_Amount,Unrealised_PnL,DV01_Par_Sens,FX_Delta_Equiv,Equity_Delta,Option_Vega"

  // Target: Risk system naming (completely different!)
  const headerB = "deal_id,portfolio_name,cpty,product_class,currency,notional_amount,mark_to_market,cash_settled,profit_loss,ir_sensitivity_bp,fx_spot_delta,eq_delta_exposure,vol_sensitivity"

  const rows: string[] = []
  const rowsB: string[] = []

  for (let i = 1; i <= 100; i++) {
    const tradeId = `T${String(i).padStart(6, "0")}`
    const book = pick(["IR_FLOW_1", "FX_SPOT_2", "EQ_DERIV_3", "CREDIT_4"])
    const cpty = pick(["JPM_NY", "GS_LON", "BARC_LON", "HSBC_HK", "BNP_PAR"])
    const typo = pick(["VANILLA_SWAP", "FX_FWD", "EQ_CALL", "CDS", "XCCY_SWAP"])
    const ccy = pick(["EUR", "USD", "GBP", "JPY"])
    const notional = round(5_000_000 + Math.random() * 100_000_000, 0)
    const mtm = round(notional * (Math.random() - 0.3) * 0.08)
    const settled = round(notional * Math.random() * 0.005)
    const pnl = round(mtm + settled)
    const dv01 = round(notional * (Math.random() * 0.00006 - 0.00003))
    const fxDelta = round(notional * (Math.random() * 0.2 - 0.1))
    const eqDelta = round(notional * (Math.random() * 0.4 - 0.2))
    const vega = round(notional * Math.random() * 0.001)

    rows.push(`${tradeId},${book},${cpty},${typo},${ccy},${notional},${mtm},${settled},${pnl},${dv01},${fxDelta},${eqDelta},${vega}`)
    // Same data, just slightly different (to show recon works after mapping)
    const shift = round((Math.random() - 0.5) * 0.02)
    rowsB.push(`${tradeId},${book},${cpty},${typo},${ccy},${notional},${round(mtm + shift)},${settled},${round(pnl + shift)},${dv01},${fxDelta},${eqDelta},${vega}`)
  }

  writeCSV(path.join(dir, "murex_extract_MX3158.csv"), headerA, rows)
  writeCSV(path.join(dir, "risk_system_extract.csv"), headerB, rowsB)

  fs.writeFileSync(path.join(dir, "README.md"), `# Demo 2: AI Field Mapping

## Scenario
Two files from DIFFERENT SYSTEMS with completely different column naming conventions.
AI must use financial domain knowledge to map them.

| Murex (Source A) | Risk System (Source B) | AI Should Map |
|-----------------|----------------------|---------------|
| TradeRef | deal_id | Trade identifier |
| Book | portfolio_name | Portfolio/Book |
| Counterparty_Code | cpty | Counterparty |
| Instrument_Type | product_class | Product type |
| Ccy | currency | Currency |
| Nominal | notional_amount | Notional |
| MtM_Value | mark_to_market | Market Value |
| Settled_Amount | cash_settled | Settled Cash |
| Unrealised_PnL | profit_loss | P&L |
| DV01_Par_Sens | ir_sensitivity_bp | IR DV01 |
| FX_Delta_Equiv | fx_spot_delta | FX Delta |
| Equity_Delta | eq_delta_exposure | EQ Delta |
| Option_Vega | vol_sensitivity | Vega |

## How to Demo
1. Go to Definitions → New Recon Template
2. Upload both files
3. Click **"AI Suggest Mappings"** button
4. AI maps all 13 columns correctly despite different names
5. Review and adjust if needed, then save
`)
}

// ═══════════════════════════════════════════════════════════════════════
// DEMO 3: Smart Explanation Key Suggestion per Row
// ═══════════════════════════════════════════════════════════════════════
// Small set (50 trades) with very specific break patterns per trade.
// Each break has a clear "fingerprint" that AI should recognize.

function demo3_SmartKeysuggestion() {
  console.log("\n🏷️  Demo 3: Smart Explanation Key Suggestion per Row")
  console.log("  Scenario: 50 trades with distinct break fingerprints\n")

  const dir = path.join(BASE, "03_smart_key_suggestion")
  const header = "trade_id,portfolio,typology,asset_class,currency,notional,market_value,pnl,dv01_par,dv01_zero,vega,theta,settled_cash,future_cash"

  const sourceRows: string[] = []
  const targetRows: string[] = []

  // Each trade has a specific, identifiable break pattern
  const scenarios = [
    // 10 trades: DV01 shifted ~3%, MV shifted proportionally → BOOTSTRAP_METHOD
    ...Array.from({ length: 10 }, (_, i) => ({ id: `BOOT${String(i+1).padStart(3,"0")}`, typo: "IRS", ac: "IR", ccy: "EUR", breakType: "bootstrap" })),
    // 8 trades: Vega shifted ~10%, theta shifted ~5% → VOL_SURFACE_INTERP
    ...Array.from({ length: 8 }, (_, i) => ({ id: `VOLS${String(i+1).padStart(3,"0")}`, typo: "FX_Option", ac: "FX", ccy: "USD", breakType: "vol_surface" })),
    // 7 trades: Cash timing shift, PnL unchanged → SETTLEMENT_DATE
    ...Array.from({ length: 7 }, (_, i) => ({ id: `SETL${String(i+1).padStart(3,"0")}`, typo: "FX_Forward", ac: "FX", ccy: "JPY", breakType: "settlement" })),
    // 5 trades: GBP, tiny PnL diff → DAYCOUNT_CONV
    ...Array.from({ length: 5 }, (_, i) => ({ id: `DAYC${String(i+1).padStart(3,"0")}`, typo: "Bond", ac: "IR", ccy: "GBP", breakType: "daycount" })),
    // 5 trades: Sub-cent diff → ROUNDING_PRECISION
    ...Array.from({ length: 5 }, (_, i) => ({ id: `RNDS${String(i+1).padStart(3,"0")}`, typo: "IRS", ac: "IR", ccy: "USD", breakType: "rounding" })),
    // 5 trades: Huge MV change on barrier options → BARRIER_ENGINE
    ...Array.from({ length: 5 }, (_, i) => ({ id: `BARR${String(i+1).padStart(3,"0")}`, typo: "FX_Barrier_Option", ac: "FX", ccy: "EUR", breakType: "barrier" })),
    // 10 trades: Perfect match (no break)
    ...Array.from({ length: 10 }, (_, i) => ({ id: `GOOD${String(i+1).padStart(3,"0")}`, typo: "IRS", ac: "IR", ccy: "EUR", breakType: "match" })),
  ]

  for (const s of scenarios) {
    const notional = round(10_000_000 + Math.random() * 50_000_000, 0)
    const mv = round(notional * (Math.random() - 0.3) * 0.08)
    const pnl = round(mv + Math.random() * 5000)
    const dv01Par = s.ac === "IR" ? round(notional * 0.00004) : 0
    const dv01Zero = round(dv01Par * 1.02)
    const vega = s.typo.includes("Option") ? round(notional * 0.001) : 0
    const theta = vega !== 0 ? round(-notional * 0.0003) : 0
    const settled = round(notional * 0.002)
    const future = round(notional * 0.005)

    const src = `${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${mv},${pnl},${dv01Par},${dv01Zero},${vega},${theta},${settled},${future}`
    sourceRows.push(src)

    if (s.breakType === "bootstrap") {
      const d = round(dv01Par * 0.03)
      targetRows.push(`${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${round(mv + d * 500)},${round(pnl + d * 500)},${round(dv01Par + d)},${round(dv01Zero + d * 1.1)},${vega},${theta},${settled},${future}`)
    } else if (s.breakType === "vol_surface") {
      const v = round(vega * 0.1)
      targetRows.push(`${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${round(mv + v * 80)},${round(pnl + v * 80)},${dv01Par},${dv01Zero},${round(vega + v)},${round(theta * 1.05)},${settled},${future}`)
    } else if (s.breakType === "settlement") {
      const c = round(notional * 0.0003)
      targetRows.push(`${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${mv},${pnl},${dv01Par},${dv01Zero},${vega},${theta},${round(settled - c)},${round(future + c)}`)
    } else if (s.breakType === "daycount") {
      const c = round(notional * 0.00003)
      targetRows.push(`${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${mv},${round(pnl + c)},${dv01Par},${dv01Zero},${vega},${theta},${round(settled + c)},${future}`)
    } else if (s.breakType === "rounding") {
      targetRows.push(`${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${round(mv + 0.01)},${round(pnl + 0.01)},${dv01Par},${dv01Zero},${vega},${theta},${settled},${future}`)
    } else if (s.breakType === "barrier") {
      const big = round(notional * (0.005 + Math.random() * 0.01))
      targetRows.push(`${s.id},FLOW_${s.ac}_${s.ccy},${s.typo},${s.ac},${s.ccy},${notional},${round(mv + big)},${round(pnl + big)},${dv01Par},${dv01Zero},${round(vega * 1.2)},${round(theta * 1.15)},${settled},${future}`)
    } else {
      targetRows.push(src)
    }
  }

  writeCSV(path.join(dir, "source_detailed.csv"), header, sourceRows)
  writeCSV(path.join(dir, "target_detailed.csv"), header, targetRows)

  // Also write an explanation keys reference
  fs.writeFileSync(path.join(dir, "README.md"), `# Demo 3: Smart Explanation Key Suggestion per Row

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
`)
}

// ═══════════════════════════════════════════════════════════════════════
// DEMO 4: Intelligent Dependency Suggestion
// ═══════════════════════════════════════════════════════════════════════
// Several downstream reports with columns that clearly map to specific
// core/sensitivity recons. AI should auto-detect dependencies.

function demo4_DependencySuggestion() {
  console.log("\n🔀 Demo 4: Intelligent Dependency Suggestion")
  console.log("  Scenario: 5 downstream reports for AI to analyze\n")

  const dir = path.join(BASE, "04_dependency_suggestion")

  // Core recon reference
  const coreHeader = "trade_id,portfolio,typology,asset_class,currency,notional,market_value,pnl,settled_cash"
  const coreRows = Array.from({ length: 50 }, (_, i) => {
    const id = `MX${String(i+1).padStart(5,"0")}`
    return `${id},${pick(["FLOW_IR_EUR","FLOW_FX_G10","EQ_DELTA1_EU"])},${pick(["IRS","FX_Forward","EQ_Option"])},${pick(["IR","FX","EQ"])},EUR,${round(10_000_000 + Math.random() * 50_000_000,0)},${round(Math.random() * 2_000_000 - 500_000)},${round(Math.random() * 100_000)},${round(Math.random() * 5_000)}`
  })
  writeCSV(path.join(dir, "core_recon_source.csv"), coreHeader, coreRows)
  writeCSV(path.join(dir, "core_recon_target.csv"), coreHeader, coreRows.map(r => {
    const parts = r.split(","); parts[6] = String(round(parseFloat(parts[6]) + (Math.random()-0.5)*1000)); return parts.join(",")
  }))

  // Downstream 1: Finance P&L — has market_value, pnl → depends on Core
  const d1Header = "trade_id,portfolio,market_value,realised_pnl,unrealised_pnl,total_pnl"
  writeCSV(path.join(dir, "downstream_finance_pnl_source.csv"), d1Header,
    coreRows.slice(0, 30).map(r => { const p = r.split(","); return `${p[0]},${p[1]},${p[6]},${round(Math.random()*5000)},${p[6]},${p[7]}` }))
  writeCSV(path.join(dir, "downstream_finance_pnl_target.csv"), d1Header,
    coreRows.slice(0, 30).map(r => { const p = r.split(","); return `${p[0]},${p[1]},${round(parseFloat(p[6])+(Math.random()-0.5)*500)},${round(Math.random()*5000)},${round(parseFloat(p[6])+(Math.random()-0.5)*500)},${round(parseFloat(p[7])+(Math.random()-0.5)*200)}` }))

  // Downstream 2: Risk VaR — has market_value, dv01, fx_delta → depends on Core + IR Sensi + FX Sensi
  const d2Header = "trade_id,portfolio,market_value,dv01_par,fx_delta,var_1d_99"
  writeCSV(path.join(dir, "downstream_var_report_source.csv"), d2Header,
    Array.from({length: 40}, (_, i) => `MX${String(i+1).padStart(5,"0")},${pick(["FLOW_IR_EUR","FLOW_FX_G10"])},${round(Math.random()*2000000-500000)},${round(Math.random()*5000-2500)},${round(Math.random()*100000-50000)},${round(Math.random()*50000)}`))
  writeCSV(path.join(dir, "downstream_var_report_target.csv"), d2Header,
    Array.from({length: 40}, (_, i) => `MX${String(i+1).padStart(5,"0")},${pick(["FLOW_IR_EUR","FLOW_FX_G10"])},${round(Math.random()*2000000-500000)},${round(Math.random()*5000-2500)},${round(Math.random()*100000-50000)},${round(Math.random()*50000)}`))

  // Downstream 3: EQ Greeks — has eq_delta, eq_vega, eq_theta → depends on EQ Sensitivity
  const d3Header = "trade_id,portfolio,eq_delta,eq_vega,eq_theta,eq_gamma"
  writeCSV(path.join(dir, "downstream_eq_greeks_source.csv"), d3Header,
    Array.from({length: 25}, (_, i) => `MX${String(i+1).padStart(5,"0")},EQ_VOL_EU,${round(Math.random()*200000-100000)},${round(Math.random()*50000)},${round(-Math.random()*10000)},${round(Math.random()*5000)}`))
  writeCSV(path.join(dir, "downstream_eq_greeks_target.csv"), d3Header,
    Array.from({length: 25}, (_, i) => `MX${String(i+1).padStart(5,"0")},EQ_VOL_EU,${round(Math.random()*200000-100000)},${round(Math.random()*50000)},${round(-Math.random()*10000)},${round(Math.random()*5000)}`))

  // Downstream 4: FRTB — has market_value, dv01, eq_delta, fx_delta, com_delta → depends on ALL
  const d4Header = "trade_id,portfolio,market_value,ir_sensitivity,equity_sensitivity,fx_sensitivity,commodity_sensitivity,risk_class"
  writeCSV(path.join(dir, "downstream_frtb_source.csv"), d4Header,
    Array.from({length: 35}, (_, i) => `MX${String(i+1).padStart(5,"0")},${pick(["FLOW_IR_EUR","FLOW_FX_G10","EQ_DELTA1_EU","COM_ENERGY"])},${round(Math.random()*3000000-1000000)},${round(Math.random()*3000-1500)},${round(Math.random()*100000-50000)},${round(Math.random()*80000-40000)},${round(Math.random()*30000-15000)},${pick(["GIRR","CSR","EQ","FX","COM"])}`))
  writeCSV(path.join(dir, "downstream_frtb_target.csv"), d4Header,
    Array.from({length: 35}, (_, i) => `MX${String(i+1).padStart(5,"0")},${pick(["FLOW_IR_EUR","FLOW_FX_G10","EQ_DELTA1_EU","COM_ENERGY"])},${round(Math.random()*3000000-1000000)},${round(Math.random()*3000-1500)},${round(Math.random()*100000-50000)},${round(Math.random()*80000-40000)},${round(Math.random()*30000-15000)},${pick(["GIRR","CSR","EQ","FX","COM"])}`))

  // Downstream 5: Commodity risk — has com_delta, com_vega → depends on COM Sensitivity
  const d5Header = "trade_id,portfolio,commodity_delta,commodity_vega,commodity_gamma,underlying"
  writeCSV(path.join(dir, "downstream_com_risk_source.csv"), d5Header,
    Array.from({length: 20}, (_, i) => `MX${String(i+1).padStart(5,"0")},COM_ENERGY,${round(Math.random()*50000-25000)},${round(Math.random()*20000)},${round(Math.random()*3000)},${pick(["BRENT","WTI","NATGAS","GOLD","COPPER"])}`))
  writeCSV(path.join(dir, "downstream_com_risk_target.csv"), d5Header,
    Array.from({length: 20}, (_, i) => `MX${String(i+1).padStart(5,"0")},COM_ENERGY,${round(Math.random()*50000-25000)},${round(Math.random()*20000)},${round(Math.random()*3000)},${pick(["BRENT","WTI","NATGAS","GOLD","COPPER"])}`))

  fs.writeFileSync(path.join(dir, "README.md"), `# Demo 4: Intelligent Dependency Suggestion

## Scenario
5 downstream reports uploaded. AI analyzes their columns and suggests
which core/sensitivity reconciliations they depend on.

| Report | Key Columns | AI Should Suggest Dependencies |
|--------|------------|-------------------------------|
| Finance P&L | market_value, pnl | → **Core Recon** |
| VaR Report | market_value, dv01_par, fx_delta | → **Core + IR Sensi + FX Sensi** |
| EQ Greeks | eq_delta, eq_vega, eq_theta | → **EQ Sensitivity** |
| FRTB | ir_sensitivity, equity_sensitivity, fx_sensitivity, commodity_sensitivity | → **Core + IR + EQ + FX + COM** (all) |
| Commodity Risk | commodity_delta, commodity_vega | → **COM Sensitivity** |

## How to Demo
1. Create Core, IR Sensi, EQ Sensi, FX Sensi, COM Sensi definitions
2. Upload each downstream report pair
3. Go to Dependencies tab
4. Click **"AI Suggest Dependencies"** for each downstream
5. AI analyzes columns and recommends: "This report contains dv01_par and fx_delta. It likely depends on Core Recon + IR Sensitivity + FX Sensitivity."
6. Accept suggestions → dependency edges created automatically
`)
}

// ═══════════════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════════════

console.log("🎭 Generating AI Demo Data\n")
console.log(`Output: ${BASE}/\n`)

demo1_BreakPatternAnalyst()
demo2_AIFieldMapping()
demo3_SmartKeysuggestion()
demo4_DependencySuggestion()

console.log("\n✅ All demo data generated!")
console.log("\nFolders:")
console.log("  01_break_pattern_analyst/   — 500 trades, clustered break patterns + anomalies")
console.log("  02_ai_field_mapping/        — Different column names between systems")
console.log("  03_smart_key_suggestion/    — 50 trades with distinct break fingerprints")
console.log("  04_dependency_suggestion/   — 5 downstream reports for dependency analysis")
console.log("\nEach folder has a README.md with demo instructions.\n")
