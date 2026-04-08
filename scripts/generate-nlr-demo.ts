/**
 * Generate demo files for Natural Language Rule assignment.
 * Uses GENERIC trade IDs (MX0000001, MX0000002...) so the demo
 * doesn't give away which key should be assigned.
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

function row(...args: (string | number)[]): string { return args.join(",") }

interface TradeSpec {
  expectedKey: string
  buildSource: (id: string) => string
  buildTarget: (id: string, src: string) => string
}

const specs: TradeSpec[] = []

// ── BOOTSTRAP_METHOD: 8 IR products ──
for (let i = 0; i < 8; i++) {
  const notional = 50_000_000 + i * 10_000_000
  const dv01 = r(notional * 0.00005)
  const mv = r(notional * 0.03)
  const pnl = r(mv + 1200)
  specs.push({
    expectedKey: "BOOTSTRAP_METHOD",
    buildSource: (id) => row(id, "FLOW_IR_EUR", "JPMORGAN", "IRS", "IR", "EUR",
      notional, "2024-03-15", "2029-03-15", mv, 1200, 3400, 1000, pnl,
      dv01, r(dv01 * 1.02), 0, 0, 0, 0, 0),
    buildTarget: (id) => {
      const shift = r(dv01 * (0.025 + Math.random() * 0.025))
      const mvS = r(shift * 400)
      return row(id, "FLOW_IR_EUR", "JPMORGAN", "IRS", "IR", "EUR",
        notional, "2024-03-15", "2029-03-15", r(mv + mvS), 1200, 3400, 1000, r(pnl + mvS),
        r(dv01 + shift), r(dv01 * 1.02 + shift * 1.1), 0, 0, 0, 0, 0)
    }
  })
}

// ── VOL_SURFACE_INTERP: 6 options ──
for (let i = 0; i < 6; i++) {
  const notional = 20_000_000 + i * 5_000_000
  const vega = r(notional * 0.0012)
  const theta = r(-notional * 0.0004)
  const mv = r(notional * 0.02)
  const typo = i < 3 ? "FX_Option" : "EQ_Option"
  const ac = i < 3 ? "FX" : "EQ"
  specs.push({
    expectedKey: "VOL_SURFACE_INTERP",
    buildSource: (id) => row(id, `FLOW_${ac}_G10`, "GOLDMAN_SACHS", typo, ac, "USD",
      notional, "2024-06-01", "2026-06-01", mv, 500, 2000, 300, r(mv + 2500),
      0, 0, ac === "FX" ? r(notional * 0.1) : 0, ac === "EQ" ? r(notional * 0.2) : 0,
      vega, theta, r(notional * 0.00002)),
    buildTarget: (id) => {
      const vS = r(vega * (0.08 + Math.random() * 0.07))
      const tS = r(theta * (0.03 + Math.random() * 0.05))
      const mvS = r(vS * 60)
      return row(id, `FLOW_${ac}_G10`, "GOLDMAN_SACHS", typo, ac, "USD",
        notional, "2024-06-01", "2026-06-01", r(mv + mvS), 500, 2000, 300, r(mv + 2500 + mvS),
        0, 0, ac === "FX" ? r(notional * 0.1) : 0, ac === "EQ" ? r(notional * 0.2) : 0,
        r(vega + vS), r(theta + tS), r(notional * 0.00002))
    }
  })
}

// ── DAYCOUNT_CONV: 5 GBP products ──
for (let i = 0; i < 5; i++) {
  const notional = 30_000_000 + i * 8_000_000
  const mv = r(notional * 0.015)
  const pnl = r(mv + 800)
  const dv01 = r(notional * 0.00004)
  const typo = i < 3 ? "IRS" : "Bond"
  specs.push({
    expectedKey: "DAYCOUNT_CONV",
    buildSource: (id) => row(id, "FLOW_IR_GBP", "BARCLAYS", typo, "IR", "GBP",
      notional, "2024-01-10", "2028-01-10", mv, 800, 1500, 600, pnl,
      dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0),
    buildTarget: (id) => {
      const tiny = r(notional * (0.00002 + Math.random() * 0.00006))
      return row(id, "FLOW_IR_GBP", "BARCLAYS", typo, "IR", "GBP",
        notional, "2024-01-10", "2028-01-10", mv, r(800 + tiny), 1500, r(600 + tiny * 0.5), r(pnl + tiny),
        dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0)
    }
  })
}

// ── FX_RATE_SOURCE: 5 FX forwards ──
for (let i = 0; i < 5; i++) {
  const notional = 40_000_000 + i * 12_000_000
  const fxDelta = r(notional * 0.15)
  const mv = r(notional * 0.01)
  specs.push({
    expectedKey: "FX_RATE_SOURCE",
    buildSource: (id) => row(id, "FLOW_FX_G10", "HSBC", "FX_Forward", "FX", "USD",
      notional, "2024-04-20", "2025-10-20", mv, 200, 4000, 150, r(mv + 4200),
      0, 0, fxDelta, 0, 0, 0, 0),
    buildTarget: (id) => {
      const dS = r(fxDelta * (0.005 + Math.random() * 0.015))
      const mvS = r(dS * 0.02)
      return row(id, "FLOW_FX_G10", "HSBC", "FX_Forward", "FX", "USD",
        notional, "2024-04-20", "2025-10-20", r(mv + mvS), 200, 4000, 150, r(mv + 4200 + mvS),
        0, 0, r(fxDelta + dS), 0, 0, 0, 0)
    }
  })
}

// ── SETTLEMENT_DATE: 5 zero-sum cash shifts ──
for (let i = 0; i < 5; i++) {
  const notional = 25_000_000 + i * 7_000_000
  const mv = r(notional * 0.02)
  const settled = r(notional * 0.003)
  const future = r(notional * 0.008)
  specs.push({
    expectedKey: "SETTLEMENT_DATE",
    buildSource: (id) => row(id, "FLOW_FX_EM", "CITIBANK", "FX_Swap", "FX", "JPY",
      notional, "2024-08-05", "2025-08-05", mv, 500, future, settled, r(mv + 500 + future),
      0, 0, r(notional * 0.08), 0, 0, 0, 0),
    buildTarget: (id) => {
      const c = r(notional * (0.0003 + Math.random() * 0.0004))
      return row(id, "FLOW_FX_EM", "CITIBANK", "FX_Swap", "FX", "JPY",
        notional, "2024-08-05", "2025-08-05", mv, 500, r(future + c), r(settled - c), r(mv + 500 + future),
        0, 0, r(notional * 0.08), 0, 0, 0, 0)
    }
  })
}

// ── ROUNDING_PRECISION: 6 mixed, all diffs < $0.05 ──
const rndTypos = ["IRS", "FX_Forward", "EQ_Forward", "COM_Swap", "Bond", "Deposit"]
const rndAcs = ["IR", "FX", "EQ", "COM", "IR", "IR"]
for (let i = 0; i < 6; i++) {
  const notional = 10_000_000 + i * 5_000_000
  const mv = r(notional * 0.025)
  const dv01 = rndAcs[i] === "IR" ? r(notional * 0.00003) : 0
  specs.push({
    expectedKey: "ROUNDING_PRECISION",
    buildSource: (id) => row(id, "MISC_BOOK", "UBS", rndTypos[i], rndAcs[i], "EUR",
      notional, "2024-02-14", "2027-02-14", mv, 300, 1800, 200, r(mv + 2100),
      dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0),
    buildTarget: (id) => {
      const t = r((Math.random() - 0.5) * 0.04)
      return row(id, "MISC_BOOK", "UBS", rndTypos[i], rndAcs[i], "EUR",
        notional, "2024-02-14", "2027-02-14", r(mv + t), 300, 1800, 200, r(mv + 2100 + t),
        dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0)
    }
  })
}

// ── BARRIER_ENGINE: 4 barrier options ──
for (let i = 0; i < 4; i++) {
  const typo = i < 2 ? "FX_Barrier_Option" : "EQ_Barrier_Option"
  const ac = i < 2 ? "FX" : "EQ"
  const notional = 15_000_000 + i * 5_000_000
  const mv = r(notional * 0.04)
  const vega = r(notional * 0.0015)
  const theta = r(-notional * 0.0005)
  specs.push({
    expectedKey: "BARRIER_ENGINE",
    buildSource: (id) => row(id, `EXOTIC_${ac}`, "NOMURA", typo, ac, "EUR",
      notional, "2024-07-01", "2026-01-01", mv, 0, 3000, 0, r(mv + 3000),
      0, 0, ac === "FX" ? r(notional * 0.12) : 0, ac === "EQ" ? r(notional * 0.25) : 0,
      vega, theta, r(notional * 0.00003)),
    buildTarget: (id) => {
      const big = r(notional * (0.006 + Math.random() * 0.008))
      return row(id, `EXOTIC_${ac}`, "NOMURA", typo, ac, "EUR",
        notional, "2024-07-01", "2026-01-01", r(mv + big), 0, 3000, 0, r(mv + 3000 + big),
        0, 0, ac === "FX" ? r(notional * 0.12) : 0, ac === "EQ" ? r(notional * 0.25) : 0,
        r(vega * 1.2), r(theta * 1.15), r(notional * 0.00003))
    }
  })
}

// ── CURVE_STRIPPING: 5 IR, zero DV01 shifts more than par ──
for (let i = 0; i < 5; i++) {
  const notional = 60_000_000 + i * 15_000_000
  const dv01 = r(notional * 0.00006)
  const dv01Z = r(dv01 * 1.04)
  const mv = r(notional * 0.02)
  specs.push({
    expectedKey: "CURVE_STRIPPING",
    buildSource: (id) => row(id, "FLOW_IR_USD", "BOFA", "IRS", "IR", "USD",
      notional, "2024-05-10", "2032-05-10", mv, 900, 2500, 700, r(mv + 3400),
      dv01, dv01Z, 0, 0, 0, 0, 0),
    buildTarget: (id) => {
      const pS = r(dv01 * (0.01 + Math.random() * 0.02))
      const zS = r(pS * (1.5 + Math.random() * 0.5))
      const mvS = r(pS * 200)
      return row(id, "FLOW_IR_USD", "BOFA", "IRS", "IR", "USD",
        notional, "2024-05-10", "2032-05-10", r(mv + mvS), 900, 2500, 700, r(mv + 3400 + mvS),
        r(dv01 + pS), r(dv01Z + zS), 0, 0, 0, 0, 0)
    }
  })
}

// ── THETA_CALC: 5 options, theta big shift, delta/vega stable ──
for (let i = 0; i < 5; i++) {
  const typo = i < 3 ? "FX_Option" : "EQ_Option"
  const ac = i < 3 ? "FX" : "EQ"
  const notional = 18_000_000 + i * 6_000_000
  const vega = r(notional * 0.001)
  const theta = r(-notional * 0.00035)
  const mv = r(notional * 0.015)
  specs.push({
    expectedKey: "THETA_CALC",
    buildSource: (id) => row(id, `VOL_${ac}`, "DEUTSCHE_BANK", typo, ac, "EUR",
      notional, "2024-09-15", "2025-09-15", mv, 100, 1500, 80, r(mv + 1600),
      0, 0, ac === "FX" ? r(notional * 0.09) : 0, ac === "EQ" ? r(notional * 0.18) : 0,
      vega, theta, r(notional * 0.00001)),
    buildTarget: (id) => {
      const tS = r(theta * (0.05 + Math.random() * 0.15))
      const mvT = r(tS * 10)
      return row(id, `VOL_${ac}`, "DEUTSCHE_BANK", typo, ac, "EUR",
        notional, "2024-09-15", "2025-09-15", r(mv + mvT), 100, 1500, 80, r(mv + 1600 + mvT),
        0, 0, ac === "FX" ? r(notional * 0.09) : 0, ac === "EQ" ? r(notional * 0.18) : 0,
        vega, r(theta + tS), r(notional * 0.00001))
    }
  })
}

// ── DATA_QUALITY: 3 anomalies ──
for (let i = 0; i < 3; i++) {
  const notional = 80_000_000 + i * 20_000_000
  const mv = r(notional * 0.01)
  const dv01 = r(notional * 0.00004)
  specs.push({
    expectedKey: "DATA_QUALITY",
    buildSource: (id) => row(id, "EXOTIC_IR_EUR", "MIZUHO", "IRS", "IR", "CHF",
      notional, "2024-11-01", "2030-11-01", mv, 400, 5000, 350, r(mv + 5400),
      dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0),
    buildTarget: (id) => {
      const huge = r((Math.random() > 0.5 ? 1 : -1) * (800_000 + Math.random() * 1_500_000))
      return row(id, "EXOTIC_IR_EUR", "MIZUHO", "IRS", "IR", "CHF",
        notional, "2024-11-01", "2030-11-01", r(mv + huge), 400, 5000, 350, r(mv + 5400 + huge),
        dv01, r(dv01 * 1.01), 0, 0, 0, 0, 0)
    }
  })
}

// ── MULTI-KEY: 4 trades → BOOTSTRAP + DAYCOUNT ──
for (let i = 0; i < 4; i++) {
  const notional = 45_000_000 + i * 10_000_000
  const dv01 = r(notional * 0.00005)
  const mv = r(notional * 0.025)
  const pnl = r(mv + 900)
  specs.push({
    expectedKey: "BOOTSTRAP_METHOD + DAYCOUNT_CONV",
    buildSource: (id) => row(id, "FLOW_IR_GBP", "NATWEST", "IRS", "IR", "GBP",
      notional, "2024-02-20", "2027-02-20", mv, 900, 2200, 700, pnl,
      dv01, r(dv01 * 1.02), 0, 0, 0, 0, 0),
    buildTarget: (id) => {
      const dS = r(dv01 * 0.035)
      const mvS = r(dS * 350)
      const tiny = r(notional * 0.00004)
      return row(id, "FLOW_IR_GBP", "NATWEST", "IRS", "IR", "GBP",
        notional, "2024-02-20", "2027-02-20", r(mv + mvS), r(900 + tiny), 2200, r(700 + tiny * 0.5), r(pnl + mvS + tiny),
        r(dv01 + dS), r(dv01 * 1.02 + dS * 1.1), 0, 0, 0, 0, 0)
    }
  })
}

// ── 20 perfect matches ──
for (let i = 0; i < 20; i++) {
  specs.push({
    expectedKey: "(match)",
    buildSource: (id) => row(id, "FLOW_IR_EUR", "BNP_PARIBAS", "IRS", "IR", "EUR",
      30_000_000, "2024-01-01", "2028-01-01", 450000, 500, 2000, 400, 452500,
      1200, 1230, 0, 0, 0, 0, 0),
    buildTarget: (id) => row(id, "FLOW_IR_EUR", "BNP_PARIBAS", "IRS", "IR", "EUR",
      30_000_000, "2024-01-01", "2028-01-01", 450000, 500, 2000, 400, 452500,
      1200, 1230, 0, 0, 0, 0, 0),
  })
}

// Shuffle specs so they're not grouped by key
const shuffled = [...specs].sort(() => Math.random() - 0.5)

// Generate with generic sequential IDs
const sources: string[] = []
const targets: string[] = []
const answerKey: string[] = ["trade_id,expected_key"]

shuffled.forEach((spec, i) => {
  const id = `MX${String(i + 1).padStart(7, "0")}`
  sources.push(spec.buildSource(id))
  targets.push(spec.buildTarget(id, spec.buildSource(id)))
  if (spec.expectedKey !== "(match)") {
    answerKey.push(`${id},${spec.expectedKey}`)
  }
})

fs.writeFileSync(path.join(OUT, "nlr_source_MX3158.csv"), header + "\n" + sources.join("\n"))
fs.writeFileSync(path.join(OUT, "nlr_target_MX3162.csv"), header + "\n" + targets.join("\n"))
fs.writeFileSync(path.join(OUT, "answer_key.csv"), answerKey.join("\n"))

console.log(`\n✅ NLR Demo files generated in demo-data/05_nlr_assignment/\n`)
console.log(`   nlr_source_MX3158.csv  (${sources.length} trades — generic IDs, shuffled)`)
console.log(`   nlr_target_MX3162.csv  (${targets.length} trades)`)
console.log(`   answer_key.csv         (${answerKey.length - 1} expected assignments — for verification only)`)
console.log(`\n   Trade IDs are MX0000001, MX0000002... — no hints about expected keys.`)
console.log(`   Trades are shuffled randomly — not grouped by pattern.\n`)
