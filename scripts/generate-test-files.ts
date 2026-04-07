/**
 * Generate small, realistic test CSV files for hands-on testing.
 *
 * Creates paired Source A / Source B files with known differences
 * so you can open them in Excel, edit them, and upload to test the tool.
 *
 * Run: npx tsx scripts/generate-test-files.ts
 */

import * as fs from "fs"
import * as path from "path"

const OUT = path.join(process.cwd(), "test-data")

function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Reference Data ──────────────────────────────────────────────────

const PORTFOLIOS = [
  "FLOW_IR_EUR", "FLOW_IR_USD", "EXOTIC_IR_EUR",
  "FLOW_FX_G10", "FLOW_FX_EM",
  "EQ_DELTA1_EU", "EQ_VOL_EU",
  "COM_ENERGY", "COM_METALS"
]

const COUNTERPARTIES = [
  "JPMORGAN", "GOLDMAN_SACHS", "BARCLAYS", "HSBC", "BNP_PARIBAS",
  "CITIBANK", "DEUTSCHE_BANK", "UBS", "NOMURA", "LCH_CLEARNET"
]

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF"]

// ── 1. Core Trade Reconciliation (200 trades) ───────────────────────

function generateCoreTrades() {
  const typologies = [
    { name: "IRS", assetClass: "IR", count: 60 },
    { name: "FX_Forward", assetClass: "FX", count: 30 },
    { name: "FX_Option", assetClass: "FX", count: 20 },
    { name: "EQ_Option", assetClass: "EQ", count: 25 },
    { name: "EQ_Forward", assetClass: "EQ", count: 15 },
    { name: "COM_Swap", assetClass: "COM", count: 15 },
    { name: "Bond", assetClass: "IR", count: 15 },
    { name: "Repo", assetClass: "IR", count: 10 },
    { name: "Deposit", assetClass: "IR", count: 10 },
  ]

  const sourceRows: string[] = []
  const targetRows: string[] = []
  const header = "trade_id,portfolio,counterparty,typology,asset_class,currency,notional,trade_date,maturity_date,market_value,past_cash,future_cash,future_pnl,settled_cash,pnl"

  let tradeNum = 0

  for (const typo of typologies) {
    for (let i = 0; i < typo.count; i++) {
      tradeNum++
      const tradeId = `MX${String(tradeNum).padStart(5, "0")}`
      const portfolio = pick(PORTFOLIOS)
      const cpty = pick(COUNTERPARTIES)
      const ccy = pick(CURRENCIES)
      const notional = round(1_000_000 + Math.random() * 50_000_000, 0)
      const tradeDate = `2024-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`
      const matDate = `2026-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`

      const mv = round(notional * (Math.random() - 0.3) * 0.1)
      const settledCash = round(notional * (Math.random() * 0.01 - 0.005))
      const pastCash = round(settledCash + notional * Math.random() * 0.003)
      const futureCash = round(notional * (Math.random() * 0.02 - 0.01))
      const futurePnl = round(mv + futureCash - pastCash)
      const pnl = round(mv + pastCash + futureCash)

      const sourceRow = `${tradeId},${portfolio},${cpty},${typo.name},${typo.assetClass},${ccy},${notional},${tradeDate},${matDate},${mv},${pastCash},${futureCash},${futurePnl},${settledCash},${pnl}`
      sourceRows.push(sourceRow)

      // Apply known differences for ~20% of trades
      const r = Math.random()
      if (r < 0.12) {
        // Bootstrap methodology: small MV shift on IR products
        const shift = round(notional * (Math.random() * 0.0002 - 0.0001))
        targetRows.push(`${tradeId},${portfolio},${cpty},${typo.name},${typo.assetClass},${ccy},${notional},${tradeDate},${matDate},${round(mv + shift)},${pastCash},${futureCash},${round(futurePnl + shift)},${settledCash},${round(pnl + shift)}`)
      } else if (r < 0.18) {
        // Vol surface: larger MV shift on options
        const shift = round(notional * (Math.random() * 0.001 - 0.0005))
        targetRows.push(`${tradeId},${portfolio},${cpty},${typo.name},${typo.assetClass},${ccy},${notional},${tradeDate},${matDate},${round(mv + shift)},${pastCash},${futureCash},${round(futurePnl + shift)},${settledCash},${round(pnl + shift)}`)
      } else if (r < 0.22) {
        // Settlement date: cash timing shift
        const cashShift = round(notional * Math.random() * 0.0005)
        targetRows.push(`${tradeId},${portfolio},${cpty},${typo.name},${typo.assetClass},${ccy},${notional},${tradeDate},${matDate},${mv},${round(pastCash - cashShift)},${round(futureCash + cashShift)},${futurePnl},${settledCash},${pnl}`)
      } else if (r < 0.24) {
        // Rounding: sub-cent diff
        const tiny = round((Math.random() - 0.5) * 0.04)
        targetRows.push(`${tradeId},${portfolio},${cpty},${typo.name},${typo.assetClass},${ccy},${notional},${tradeDate},${matDate},${round(mv + tiny)},${pastCash},${futureCash},${futurePnl},${settledCash},${round(pnl + tiny)}`)
      } else {
        // Exact match
        targetRows.push(sourceRow)
      }
    }
  }

  // Add 3 trades missing in target, 2 extra in target
  sourceRows.push(`MX_MISS1,FLOW_IR_EUR,JPMORGAN,IRS,IR,EUR,10000000,2024-03-15,2027-03-15,50000,1200,3400,52200,1000,54600`)
  sourceRows.push(`MX_MISS2,FLOW_FX_G10,HSBC,FX_Forward,FX,USD,25000000,2024-06-01,2025-12-01,-120000,500,8000,-111500,300,-111500`)
  sourceRows.push(`MX_MISS3,EQ_DELTA1_EU,BARCLAYS,EQ_Option,EQ,EUR,5000000,2024-09-10,2026-06-10,75000,0,2000,77000,0,77000`)

  targetRows.push(`MX_NEW01,COM_ENERGY,CITIBANK,COM_Swap,COM,USD,15000000,2025-01-15,2027-01-15,30000,0,5000,35000,0,35000`)
  targetRows.push(`MX_NEW02,FLOW_IR_USD,GOLDMAN_SACHS,IRS,IR,USD,8000000,2025-02-01,2030-02-01,-15000,2000,4000,-11000,1500,-9000`)

  fs.writeFileSync(path.join(OUT, "core_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "core_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ Core recon: ${sourceRows.length} source, ${targetRows.length} target`)
}

// ── 2. IR Sensitivity Reconciliation (100 IR trades) ────────────────

function generateIRSensitivity() {
  const header = "trade_id,portfolio,typology,currency,notional,dv01_par,dv01_zero,ir_vega"
  const sourceRows: string[] = []
  const targetRows: string[] = []

  for (let i = 1; i <= 100; i++) {
    const tradeId = `MX${String(i).padStart(5, "0")}`
    const portfolio = pick(["FLOW_IR_EUR", "FLOW_IR_USD", "EXOTIC_IR_EUR"])
    const typo = pick(["IRS", "IRS", "IRS", "Bond", "IR_Option", "Deposit"])
    const ccy = pick(CURRENCIES)
    const notional = round(5_000_000 + Math.random() * 100_000_000, 0)
    const dv01Par = round(notional * (Math.random() * 0.00008 - 0.00004))
    const dv01Zero = round(dv01Par * (1 + (Math.random() * 0.08 - 0.04)))
    const irVega = typo.includes("Option") ? round(notional * Math.random() * 0.0003) : 0

    sourceRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${dv01Par},${dv01Zero},${irVega}`)

    if (Math.random() < 0.25) {
      // Curve stripping / bootstrap diff
      const dv01Shift = round(dv01Par * (Math.random() * 0.05 - 0.025))
      targetRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${round(dv01Par + dv01Shift)},${round(dv01Zero + dv01Shift * 1.1)},${irVega}`)
    } else {
      targetRows.push(sourceRows[sourceRows.length - 1])
    }
  }

  fs.writeFileSync(path.join(OUT, "ir_sensi_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "ir_sensi_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ IR sensitivity: ${sourceRows.length} trades`)
}

// ── 3. EQ Sensitivity Reconciliation (50 EQ trades) ─────────────────

function generateEQSensitivity() {
  const header = "trade_id,portfolio,typology,currency,notional,eq_delta,eq_vega,eq_theta"
  const sourceRows: string[] = []
  const targetRows: string[] = []

  for (let i = 1; i <= 50; i++) {
    const tradeId = `MX${String(130 + i).padStart(5, "0")}`
    const portfolio = pick(["EQ_DELTA1_EU", "EQ_VOL_EU"])
    const typo = pick(["EQ_Option", "EQ_Forward", "EQ_Future", "EQ_Barrier_Option"])
    const ccy = pick(["EUR", "USD", "GBP"])
    const notional = round(500_000 + Math.random() * 20_000_000, 0)
    const eqDelta = round(notional * (Math.random() * 0.6 - 0.3))
    const eqVega = typo.includes("Option") || typo.includes("Barrier") ? round(notional * Math.random() * 0.002) : 0
    const eqTheta = eqVega !== 0 ? round(-Math.abs(notional * Math.random() * 0.0008)) : 0

    sourceRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${eqDelta},${eqVega},${eqTheta}`)

    if (Math.random() < 0.2) {
      // Vol surface change
      targetRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${round(eqDelta * (1 + (Math.random() * 0.01 - 0.005)))},${round(eqVega * (1 + (Math.random() * 0.12 - 0.06)))},${round(eqTheta * (1 + (Math.random() * 0.08 - 0.04)))}`)
    } else {
      targetRows.push(sourceRows[sourceRows.length - 1])
    }
  }

  fs.writeFileSync(path.join(OUT, "eq_sensi_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "eq_sensi_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ EQ sensitivity: ${sourceRows.length} trades`)
}

// ── 4. FX Sensitivity (60 FX trades) ────────────────────────────────

function generateFXSensitivity() {
  const header = "trade_id,portfolio,typology,currency,notional,fx_delta,fx_vega,fx_theta,fx_gamma"
  const sourceRows: string[] = []
  const targetRows: string[] = []

  for (let i = 1; i <= 60; i++) {
    const tradeId = `MX${String(80 + i).padStart(5, "0")}`
    const portfolio = pick(["FLOW_FX_G10", "FLOW_FX_EM"])
    const typo = pick(["FX_Forward", "FX_Swap", "FX_Option", "FX_Barrier_Option"])
    const ccy = pick(CURRENCIES)
    const notional = round(2_000_000 + Math.random() * 100_000_000, 0)
    const fxDelta = round(notional * (Math.random() * 0.4 - 0.2))
    const isOption = typo.includes("Option") || typo.includes("Barrier")
    const fxVega = isOption ? round(notional * Math.random() * 0.0015) : 0
    const fxTheta = isOption ? round(-Math.abs(notional * Math.random() * 0.0004)) : 0
    const fxGamma = isOption ? round(notional * Math.random() * 0.00003) : 0

    sourceRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${fxDelta},${fxVega},${fxTheta},${fxGamma}`)

    if (Math.random() < 0.2) {
      targetRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${round(fxDelta * (1 + (Math.random() * 0.015 - 0.0075)))},${round(fxVega * (1 + (Math.random() * 0.1 - 0.05)))},${round(fxTheta * (1 + (Math.random() * 0.08 - 0.04)))},${round(fxGamma * (1 + (Math.random() * 0.06 - 0.03)))}`)
    } else {
      targetRows.push(sourceRows[sourceRows.length - 1])
    }
  }

  fs.writeFileSync(path.join(OUT, "fx_sensi_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "fx_sensi_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ FX sensitivity: ${sourceRows.length} trades`)
}

// ── 5. Downstream: Daily P&L Report (150 rows, aggregated) ─────────

function generateDailyPnL() {
  const header = "trade_id,portfolio,typology,currency,market_value,pnl,settled_cash"
  const sourceRows: string[] = []
  const targetRows: string[] = []

  for (let i = 1; i <= 150; i++) {
    const tradeId = `MX${String(i).padStart(5, "0")}`
    const portfolio = pick(PORTFOLIOS)
    const typo = pick(["IRS", "FX_Forward", "EQ_Option", "COM_Swap", "Bond"])
    const ccy = pick(CURRENCIES)
    const mv = round(Math.random() * 2_000_000 - 500_000)
    const pnl = round(mv + Math.random() * 50_000)
    const settled = round(Math.random() * 10_000)

    sourceRows.push(`${tradeId},${portfolio},${typo},${ccy},${mv},${pnl},${settled}`)

    if (Math.random() < 0.15) {
      // Inherit diff from core recon
      const shift = round((Math.random() - 0.5) * 500)
      targetRows.push(`${tradeId},${portfolio},${typo},${ccy},${round(mv + shift)},${round(pnl + shift)},${settled}`)
    } else {
      targetRows.push(sourceRows[sourceRows.length - 1])
    }
  }

  fs.writeFileSync(path.join(OUT, "daily_pnl_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "daily_pnl_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ Daily P&L report: ${sourceRows.length} rows`)
}

// ── 6. Downstream: VaR Report (100 rows) ────────────────────────────

function generateVaR() {
  const header = "trade_id,portfolio,typology,currency,market_value,dv01,eq_delta,fx_delta"
  const sourceRows: string[] = []
  const targetRows: string[] = []

  for (let i = 1; i <= 100; i++) {
    const tradeId = `MX${String(i).padStart(5, "0")}`
    const portfolio = pick(PORTFOLIOS)
    const typo = pick(["IRS", "FX_Forward", "EQ_Option", "COM_Swap"])
    const ccy = pick(CURRENCIES)
    const mv = round(Math.random() * 5_000_000 - 1_000_000)
    const dv01 = round(Math.random() * 5000 - 2500)
    const eqDelta = round(Math.random() * 100_000 - 50_000)
    const fxDelta = round(Math.random() * 200_000 - 100_000)

    sourceRows.push(`${tradeId},${portfolio},${typo},${ccy},${mv},${dv01},${eqDelta},${fxDelta}`)

    if (Math.random() < 0.2) {
      targetRows.push(`${tradeId},${portfolio},${typo},${ccy},${round(mv + (Math.random() - 0.5) * 1000)},${round(dv01 * (1 + (Math.random() * 0.04 - 0.02)))},${round(eqDelta * (1 + (Math.random() * 0.01 - 0.005)))},${round(fxDelta * (1 + (Math.random() * 0.01 - 0.005)))}`)
    } else {
      targetRows.push(sourceRows[sourceRows.length - 1])
    }
  }

  fs.writeFileSync(path.join(OUT, "var_report_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "var_report_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ VaR report: ${sourceRows.length} rows`)
}

// ── 7. Downstream: FRTB SA Report (80 rows) ────────────────────────

function generateFRTB() {
  const header = "trade_id,portfolio,typology,currency,notional,market_value,sensitivity_bucket,risk_weight"
  const sourceRows: string[] = []
  const targetRows: string[] = []
  const buckets = ["GIRR", "CSR_NS", "EQ", "FX", "COM"]

  for (let i = 1; i <= 80; i++) {
    const tradeId = `MX${String(i).padStart(5, "0")}`
    const portfolio = pick(PORTFOLIOS)
    const typo = pick(["IRS", "FX_Forward", "EQ_Option", "Bond"])
    const ccy = pick(CURRENCIES)
    const notional = round(5_000_000 + Math.random() * 50_000_000, 0)
    const mv = round(notional * (Math.random() - 0.3) * 0.08)
    const bucket = pick(buckets)
    const rw = round(0.5 + Math.random() * 15, 1)

    sourceRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${mv},${bucket},${rw}`)

    if (Math.random() < 0.15) {
      targetRows.push(`${tradeId},${portfolio},${typo},${ccy},${notional},${round(mv + (Math.random() - 0.5) * 2000)},${bucket},${round(rw * (1 + (Math.random() * 0.02 - 0.01)), 1)}`)
    } else {
      targetRows.push(sourceRows[sourceRows.length - 1])
    }
  }

  fs.writeFileSync(path.join(OUT, "frtb_sa_source_MX3158.csv"), header + "\n" + sourceRows.join("\n"))
  fs.writeFileSync(path.join(OUT, "frtb_sa_target_MX3162.csv"), header + "\n" + targetRows.join("\n"))
  console.log(`  ✓ FRTB SA report: ${sourceRows.length} rows`)
}

// ── Run all generators ──────────────────────────────────────────────

console.log("\n📁 Generating test CSV files in test-data/\n")

generateCoreTrades()
generateIRSensitivity()
generateEQSensitivity()
generateFXSensitivity()
generateDailyPnL()
generateVaR()
generateFRTB()

console.log(`\n✅ All test files generated in: ${OUT}/\n`)
console.log("Files created:")
const files = fs.readdirSync(OUT).filter(f => f.endsWith(".csv")).sort()
for (const f of files) {
  const stats = fs.statSync(path.join(OUT, f))
  const lines = fs.readFileSync(path.join(OUT, f), "utf-8").split("\n").length - 1
  console.log(`  ${f.padEnd(40)} ${lines} rows  (${(stats.size / 1024).toFixed(1)} KB)`)
}
console.log(`\nUpload these to the app via Files tab or use "Run with Files" to test reconciliation.`)
