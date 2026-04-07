/**
 * Seed Data Generator for Black Glass AI RECON
 * ==============================================
 * Simulates a Murex MX.3 system upgrade reconciliation:
 *
 *   MX 3.1.58 (Source) → MX 3.1.62 (Target)
 *
 * Generates:
 *   - 10,000 trades across 20+ typologies
 *   - Core reconciliation (MV, P&L, Cash)
 *   - 4 sensitivity reconciliations (IR, EQ, FX, COM)
 *   - 25 downstream report reconciliations
 *   - Dependency tree connecting everything
 *   - Realistic explanation keys from known upgrade changes
 *
 * Run: npx tsx scripts/seed.ts
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { v4 as uuid } from "uuid"
import * as fs from "fs"
import * as path from "path"

// ── Schema imports ──────────────────────────────────────────────────────
import { reconciliationProjectsTable } from "../db/schema/projects-schema"
import { regressionCyclesTable } from "../db/schema/cycles-schema"
import { uploadedFilesTable } from "../db/schema/uploaded-files-schema"
import { reconciliationDefinitionsTable } from "../db/schema/definitions-schema"
import { fieldMappingsTable } from "../db/schema/field-mappings-schema"
import { explanationKeysTable } from "../db/schema/explanation-keys-schema"
import { dependencyEdgesTable } from "../db/schema/dependency-edges-schema"
import { reconciliationRunsTable } from "../db/schema/runs-schema"
import { reconciliationResultsTable } from "../db/schema/results-schema"
import { resultFieldDetailsTable } from "../db/schema/result-field-details-schema"

// ── Database connection ─────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error("DATABASE_URL not set")
  process.exit(1)
}
const client = postgres(connectionString)
const db = drizzle(client)

// ── Seed Configuration ──────────────────────────────────────────────────
const TOTAL_TRADES = 10_000
const MATCH_RATE = 0.80 // 80% perfect match
// Set this to your Clerk user ID, or pass SEED_USER_ID env var
const SEED_USER_ID = process.env.SEED_USER_ID || "user_3BzQhhEIkF9GxlLuLgP5hXNCW52"

// ── Reference Data ──────────────────────────────────────────────────────

const TYPOLOGIES = [
  { name: "IRS", assetClass: "IR", weight: 20 },
  { name: "IR_Option", assetClass: "IR", weight: 4 },
  { name: "IR_Cap_Floor", assetClass: "IR", weight: 3 },
  { name: "Bond", assetClass: "IR", weight: 5 },
  { name: "Bond_Forward", assetClass: "IR", weight: 3 },
  { name: "Repo", assetClass: "IR", weight: 4 },
  { name: "Buy_Sell_Back", assetClass: "IR", weight: 2 },
  { name: "Deposit", assetClass: "IR", weight: 3 },
  { name: "Loan", assetClass: "IR", weight: 2 },
  { name: "Short_Paper", assetClass: "IR", weight: 1 },
  { name: "FX_Forward", assetClass: "FX", weight: 8 },
  { name: "FX_Swap", assetClass: "FX", weight: 6 },
  { name: "FX_Option", assetClass: "FX", weight: 5 },
  { name: "FX_Barrier_Option", assetClass: "FX", weight: 2 },
  { name: "FX_Future", assetClass: "FX", weight: 2 },
  { name: "Quanto", assetClass: "FX", weight: 1 },
  { name: "EQ_Option", assetClass: "EQ", weight: 6 },
  { name: "EQ_Forward", assetClass: "EQ", weight: 4 },
  { name: "EQ_Future", assetClass: "EQ", weight: 3 },
  { name: "EQ_Barrier_Option", assetClass: "EQ", weight: 2 },
  { name: "EQ_Average_Option", assetClass: "EQ", weight: 1 },
  { name: "COM_Forward", assetClass: "COM", weight: 3 },
  { name: "COM_Swap", assetClass: "COM", weight: 3 },
  { name: "COM_Future", assetClass: "COM", weight: 2 },
  { name: "COM_Average_Option", assetClass: "COM", weight: 1 },
  { name: "Call_Account", assetClass: "IR", weight: 1 },
]

const PORTFOLIOS = [
  "FLOW_IR_EUR", "FLOW_IR_USD", "FLOW_IR_GBP", "FLOW_IR_JPY",
  "EXOTIC_IR_EUR", "EXOTIC_IR_USD",
  "FLOW_FX_G10", "FLOW_FX_EM", "EXOTIC_FX_G10",
  "EQ_DELTA1_EU", "EQ_DELTA1_US", "EQ_VOL_EU", "EQ_VOL_US", "EQ_EXOTICS",
  "COM_ENERGY", "COM_METALS", "COM_AGRI",
  "REPO_BOOK", "MM_BOOK", "COLLATERAL_MGMT",
  "XVA_CVA", "XVA_FVA", "HEDGING_IR", "HEDGING_FX", "TREASURY"
]

const COUNTERPARTIES = [
  "JPMORGAN", "GOLDMAN_SACHS", "MORGAN_STANLEY", "BARCLAYS", "DEUTSCHE_BANK",
  "UBS", "CREDIT_SUISSE", "HSBC", "BNP_PARIBAS", "SOCIETE_GENERALE",
  "CITIBANK", "BOFA", "NOMURA", "MIZUHO", "SUMITOMO",
  "RBC", "TD_BANK", "ANZ", "NATWEST", "STANDARD_CHARTERED",
  "ING", "ABN_AMRO", "COMMERZBANK", "UNICREDIT", "INTESA",
  "LCH_CLEARNET", "CME_CLEARING", "EUREX_CLEARING", "ICE_CLEAR",
  "INTERNAL_HEDGE"
]

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "AUD", "CAD", "SEK", "NOK", "NZD"]

// Explanation keys: realistic reasons for breaks in a Murex upgrade
const EXPLANATION_KEYS = [
  {
    code: "BOOTSTRAP_METHOD",
    label: "IR Curve Bootstrap Methodology Change",
    description: "MX 3.1.62 uses improved piecewise cubic Hermite interpolation for IR curve bootstrapping, replacing linear on zero rates. Affects DV01 and market values on IR products.",
    color: "#3b82f6",
    autoMatchPattern: { field: "market_value", diffRange: [-500, 500] },
    affectsAssetClass: ["IR"]
  },
  {
    code: "VOL_SURFACE_INTERP",
    label: "Volatility Surface Interpolation Change",
    description: "Upgraded vol surface uses SABR interpolation instead of cubic spline between strikes. Impacts vega and option market values.",
    color: "#8b5cf6",
    autoMatchPattern: { field: "market_value", diffRange: [-2000, 2000] },
    affectsAssetClass: ["FX", "EQ", "COM"]
  },
  {
    code: "DAYCOUNT_CONV",
    label: "Day Count Convention Correction",
    description: "Fixed ACT/365.25 to ACT/365F for GBP products per ISDA 2024 guidance. Affects accrued interest and P&L.",
    color: "#f59e0b",
    autoMatchPattern: { field: "pnl", diffRange: [-100, 100] },
    affectsAssetClass: ["IR"]
  },
  {
    code: "FX_RATE_SOURCE",
    label: "FX Fixing Source Change",
    description: "ECB fixing rates replaced with WMR 4pm fixing for non-EUR crosses. Impacts FX delta and cross-currency basis.",
    color: "#06b6d4",
    autoMatchPattern: { field: "fx_delta", diffRange: [-1000, 1000] },
    affectsAssetClass: ["FX"]
  },
  {
    code: "SETTLEMENT_DATE",
    label: "Settlement Date Handling Fix",
    description: "Corrected T+2 settlement calendar for APAC holidays. Affects cash timing between past_cash and future_cash.",
    color: "#10b981",
    autoMatchPattern: null,
    affectsAssetClass: ["IR", "FX"]
  },
  {
    code: "ROUNDING_PRECISION",
    label: "Rounding Precision Increase",
    description: "Internal calculation precision increased from 8 to 12 decimal places. Causes sub-cent differences across all products.",
    color: "#6b7280",
    autoMatchPattern: { field: "market_value", diffRange: [-0.05, 0.05] },
    affectsAssetClass: ["IR", "FX", "EQ", "COM"]
  },
  {
    code: "BARRIER_ENGINE",
    label: "Barrier Option Pricing Engine Upgrade",
    description: "New Monte Carlo barrier engine with variance reduction. Affects barrier option MV and Greeks significantly.",
    color: "#ef4444",
    autoMatchPattern: { field: "market_value", diffRange: [-10000, 10000] },
    affectsAssetClass: ["FX", "EQ"]
  },
  {
    code: "CURVE_STRIPPING",
    label: "OIS Discounting Curve Stripping",
    description: "Multi-curve framework updated: OIS-SOFR spread recalibrated post-LIBOR transition. Impacts IR DV01 and market values.",
    color: "#ec4899",
    autoMatchPattern: { field: "dv01_zero", diffRange: [-50, 50] },
    affectsAssetClass: ["IR"]
  },
  {
    code: "THETA_CALC",
    label: "Theta Calculation Method Change",
    description: "Theta now computed with sticky delta rather than sticky strike. Affects daily P&L attribution on options books.",
    color: "#a855f7",
    autoMatchPattern: null,
    affectsAssetClass: ["FX", "EQ", "COM"]
  },
  {
    code: "QUANTO_CORR",
    label: "Quanto Correlation Surface Update",
    description: "Quanto correlation model switched from flat correlation to term-structure model. Impacts quanto-adjusted Greeks.",
    color: "#14b8a6",
    autoMatchPattern: null,
    affectsAssetClass: ["FX"]
  },
  {
    code: "REPO_ACCRUAL",
    label: "Repo Accrual Methodology Change",
    description: "Repo/BSB accrual now uses clean price methodology instead of dirty price. Affects past_cash and settled_cash.",
    color: "#f97316",
    autoMatchPattern: null,
    affectsAssetClass: ["IR"]
  },
  {
    code: "COMMODITY_CURVE",
    label: "Commodity Forward Curve Construction",
    description: "Seasonal adjustment model updated for energy commodities. Affects forward prices and commodity delta.",
    color: "#84cc16",
    autoMatchPattern: null,
    affectsAssetClass: ["COM"]
  },
  {
    code: "XVA_MODEL",
    label: "XVA Model Recalibration",
    description: "CVA/FVA simulation switched to GPU-accelerated American Monte Carlo. Affects XVA P&L components.",
    color: "#dc2626",
    autoMatchPattern: null,
    affectsAssetClass: ["IR", "FX", "EQ", "COM"]
  },
  {
    code: "TRADE_POPULATION",
    label: "Trade Population Difference",
    description: "Trade exists in source but not in target (or vice versa) due to migration filtering or lifecycle event handling.",
    color: "#78716c",
    autoMatchPattern: null,
    affectsAssetClass: ["IR", "FX", "EQ", "COM"]
  },
]

// 25 downstream reports that depend on core + sensitivity recons
const DOWNSTREAM_REPORTS = [
  // Finance / Accounting
  { name: "Daily P&L Report", dept: "Finance", dependsOn: ["core"], filePrefix: "daily_pnl" },
  { name: "Monthly P&L Attribution", dept: "Finance", dependsOn: ["core", "ir_sensi", "fx_sensi"], filePrefix: "monthly_pnl_attrib" },
  { name: "FX P&L Explanation", dept: "Finance", dependsOn: ["core", "fx_sensi"], filePrefix: "fx_pnl_explain" },
  { name: "General Ledger Feed", dept: "Accounting", dependsOn: ["core"], filePrefix: "gl_feed" },
  { name: "Accounting Entries Extract", dept: "Accounting", dependsOn: ["core"], filePrefix: "acct_entries" },

  // Market Risk
  { name: "VaR Report - Parametric", dept: "Market Risk", dependsOn: ["core", "ir_sensi", "eq_sensi", "fx_sensi", "com_sensi"], filePrefix: "var_parametric" },
  { name: "VaR Report - Historical", dept: "Market Risk", dependsOn: ["core", "ir_sensi", "eq_sensi", "fx_sensi", "com_sensi"], filePrefix: "var_historical" },
  { name: "Stress Testing Results", dept: "Market Risk", dependsOn: ["ir_sensi", "eq_sensi", "fx_sensi", "com_sensi"], filePrefix: "stress_test" },
  { name: "IR DV01 Ladder Report", dept: "Market Risk", dependsOn: ["ir_sensi"], filePrefix: "ir_dv01_ladder" },
  { name: "FX Sensitivity Report", dept: "Market Risk", dependsOn: ["fx_sensi"], filePrefix: "fx_sensi_report" },
  { name: "Equity Greeks Report", dept: "Market Risk", dependsOn: ["eq_sensi"], filePrefix: "eq_greeks" },
  { name: "Commodity Risk Report", dept: "Market Risk", dependsOn: ["com_sensi"], filePrefix: "com_risk" },
  { name: "Cross-Gamma Matrix", dept: "Market Risk", dependsOn: ["ir_sensi", "fx_sensi", "eq_sensi"], filePrefix: "cross_gamma" },

  // Trading / Middle Office
  { name: "Desk P&L Report - IR", dept: "Trading", dependsOn: ["core", "ir_sensi"], filePrefix: "desk_pnl_ir" },
  { name: "Desk P&L Report - FX", dept: "Trading", dependsOn: ["core", "fx_sensi"], filePrefix: "desk_pnl_fx" },
  { name: "Desk P&L Report - EQ", dept: "Trading", dependsOn: ["core", "eq_sensi"], filePrefix: "desk_pnl_eq" },
  { name: "Intraday Risk View", dept: "Middle Office", dependsOn: ["core", "ir_sensi", "fx_sensi"], filePrefix: "intraday_risk" },
  { name: "Collateral Margin Call", dept: "Middle Office", dependsOn: ["core"], filePrefix: "margin_call" },
  { name: "Position Reconciliation", dept: "Middle Office", dependsOn: ["core"], filePrefix: "position_recon" },

  // Regulatory Reporting
  { name: "FRTB IMA Report", dept: "Regulatory", dependsOn: ["ir_sensi", "eq_sensi", "fx_sensi", "com_sensi"], filePrefix: "frtb_ima" },
  { name: "FRTB SA Report", dept: "Regulatory", dependsOn: ["ir_sensi", "eq_sensi", "fx_sensi", "com_sensi"], filePrefix: "frtb_sa" },
  { name: "Large Exposure Report", dept: "Regulatory", dependsOn: ["core"], filePrefix: "large_exposure" },
  { name: "Liquidity Coverage Ratio", dept: "Regulatory", dependsOn: ["core"], filePrefix: "lcr" },

  // XVA
  { name: "CVA Report", dept: "XVA", dependsOn: ["core", "ir_sensi", "fx_sensi"], filePrefix: "cva_report" },
  { name: "FVA Report", dept: "XVA", dependsOn: ["core", "ir_sensi"], filePrefix: "fva_report" },
]

// ── Helper Functions ────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick<T extends { weight: number }>(arr: T[]): T {
  const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0)
  let r = Math.random() * totalWeight
  for (const item of arr) {
    r -= item.weight
    if (r <= 0) return item
  }
  return arr[arr.length - 1]
}

function round(n: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return d.toISOString().split("T")[0]
}

function generateTradeId(index: number): string {
  return `MX${String(index + 1).padStart(7, "0")}`
}

function generateNotional(typology: string): number {
  const base: Record<string, [number, number]> = {
    IRS: [1_000_000, 500_000_000],
    IR_Option: [5_000_000, 200_000_000],
    IR_Cap_Floor: [5_000_000, 100_000_000],
    Bond: [1_000_000, 100_000_000],
    Bond_Forward: [5_000_000, 50_000_000],
    Repo: [10_000_000, 500_000_000],
    Buy_Sell_Back: [10_000_000, 200_000_000],
    Deposit: [1_000_000, 100_000_000],
    Loan: [5_000_000, 200_000_000],
    Short_Paper: [1_000_000, 50_000_000],
    FX_Forward: [1_000_000, 200_000_000],
    FX_Swap: [5_000_000, 500_000_000],
    FX_Option: [1_000_000, 100_000_000],
    FX_Barrier_Option: [5_000_000, 50_000_000],
    FX_Future: [1_000_000, 50_000_000],
    Quanto: [5_000_000, 100_000_000],
    EQ_Option: [100_000, 50_000_000],
    EQ_Forward: [500_000, 50_000_000],
    EQ_Future: [100_000, 20_000_000],
    EQ_Barrier_Option: [1_000_000, 30_000_000],
    EQ_Average_Option: [1_000_000, 20_000_000],
    COM_Forward: [500_000, 50_000_000],
    COM_Swap: [1_000_000, 100_000_000],
    COM_Future: [100_000, 20_000_000],
    COM_Average_Option: [500_000, 30_000_000],
    Call_Account: [100_000, 50_000_000],
  }
  const [min, max] = base[typology] ?? [1_000_000, 100_000_000]
  return round(min + Math.random() * (max - min), 0)
}

// ── Trade Generator ─────────────────────────────────────────────────────

interface Trade {
  tradeId: string
  portfolio: string
  counterparty: string
  typology: string
  assetClass: string
  currency: string
  notional: number
  tradeDate: string
  maturityDate: string
  // Metrics
  marketValue: number
  pastCash: number
  futureCash: number
  futurePnl: number
  settledCash: number
  pnl: number
  // Sensitivities (populated based on asset class)
  dv01Par: number | null
  dv01Zero: number | null
  irVega: number | null
  eqDelta: number | null
  eqVega: number | null
  eqTheta: number | null
  fxDelta: number | null
  fxVega: number | null
  fxTheta: number | null
  fxGamma: number | null
  comDelta: number | null
  comVega: number | null
}

function generateSourceTrade(index: number): Trade {
  const typo = weightedPick(TYPOLOGIES)
  const portfolio = pick(PORTFOLIOS.filter(p =>
    typo.assetClass === "IR" ? p.includes("IR") || p.includes("REPO") || p.includes("MM") || p.includes("COLLATERAL") || p.includes("XVA") || p.includes("TREASURY") :
    typo.assetClass === "FX" ? p.includes("FX") || p.includes("XVA") :
    typo.assetClass === "EQ" ? p.includes("EQ") || p.includes("XVA") :
    p.includes("COM") || p.includes("XVA")
  ) || [pick(PORTFOLIOS)])

  const notional = generateNotional(typo.name)
  const mvFactor = (Math.random() - 0.3) * 0.15 // -4.5% to +10.5% of notional
  const marketValue = round(notional * mvFactor)

  const settledCash = round(notional * (Math.random() * 0.02 - 0.01))
  const pastCash = round(settledCash + notional * (Math.random() * 0.005))
  const futureCash = round(notional * (Math.random() * 0.03 - 0.015))
  const futurePnl = round(marketValue + futureCash - pastCash)
  const pnl = round(marketValue + pastCash + futureCash)

  // Sensitivities based on asset class
  let dv01Par = null, dv01Zero = null, irVega = null
  let eqDelta = null, eqVega = null, eqTheta = null
  let fxDelta = null, fxVega = null, fxTheta = null, fxGamma = null
  let comDelta = null, comVega = null

  if (typo.assetClass === "IR") {
    dv01Par = round(notional * (Math.random() * 0.0001 - 0.00005))
    dv01Zero = round(dv01Par * (1 + (Math.random() * 0.1 - 0.05)))
    if (typo.name.includes("Option") || typo.name.includes("Cap")) {
      irVega = round(notional * Math.random() * 0.0005)
    }
  }
  if (typo.assetClass === "EQ") {
    eqDelta = round(notional * (Math.random() * 0.8 - 0.4))
    if (typo.name.includes("Option") || typo.name.includes("Barrier") || typo.name.includes("Average")) {
      eqVega = round(notional * Math.random() * 0.003)
      eqTheta = round(-Math.abs(notional * Math.random() * 0.001))
    }
  }
  if (typo.assetClass === "FX") {
    fxDelta = round(notional * (Math.random() * 0.5 - 0.25))
    if (typo.name.includes("Option") || typo.name.includes("Barrier") || typo.name === "Quanto") {
      fxVega = round(notional * Math.random() * 0.002)
      fxTheta = round(-Math.abs(notional * Math.random() * 0.0005))
      fxGamma = round(notional * Math.random() * 0.00005)
    }
  }
  if (typo.assetClass === "COM") {
    comDelta = round(notional * (Math.random() * 0.6 - 0.3))
    if (typo.name.includes("Option") || typo.name.includes("Average")) {
      comVega = round(notional * Math.random() * 0.002)
    }
  }

  return {
    tradeId: generateTradeId(index),
    portfolio,
    counterparty: pick(COUNTERPARTIES),
    typology: typo.name,
    assetClass: typo.assetClass,
    currency: pick(CURRENCIES),
    notional,
    tradeDate: randomDate(new Date("2020-01-01"), new Date("2025-12-31")),
    maturityDate: randomDate(new Date("2025-06-01"), new Date("2055-12-31")),
    marketValue, pastCash, futureCash, futurePnl, settledCash, pnl,
    dv01Par, dv01Zero, irVega,
    eqDelta, eqVega, eqTheta,
    fxDelta, fxVega, fxTheta, fxGamma,
    comDelta, comVega,
  }
}

type BreakReason = typeof EXPLANATION_KEYS[number]["code"]

function applyBreak(source: Trade): { target: Trade; reasons: BreakReason[] } {
  const target = { ...source }
  const reasons: BreakReason[] = []

  // Decide which break(s) to apply based on asset class and random selection
  const r = Math.random()

  // Always apply rounding (small noise) for realism
  if (r < 0.15) {
    // Rounding only
    target.marketValue = round(source.marketValue + (Math.random() - 0.5) * 0.08)
    target.pnl = round(source.pnl + (Math.random() - 0.5) * 0.08)
    reasons.push("ROUNDING_PRECISION")
  } else if (r < 0.40 && source.assetClass === "IR") {
    // IR Bootstrap methodology change
    const mvShift = round(source.notional * (Math.random() * 0.0003 - 0.00015))
    target.marketValue = round(source.marketValue + mvShift)
    target.pnl = round(source.pnl + mvShift)
    if (source.dv01Par !== null) {
      target.dv01Par = round(source.dv01Par * (1 + (Math.random() * 0.06 - 0.03)))
      target.dv01Zero = round(source.dv01Zero! * (1 + (Math.random() * 0.08 - 0.04)))
    }
    reasons.push("BOOTSTRAP_METHOD")
    if (Math.random() < 0.3) {
      target.settledCash = round(source.settledCash + (Math.random() - 0.5) * 50)
      target.pastCash = round(source.pastCash + (Math.random() - 0.5) * 50)
      reasons.push("DAYCOUNT_CONV")
    }
  } else if (r < 0.55 && source.assetClass === "IR") {
    // Curve stripping
    if (source.dv01Par !== null) {
      target.dv01Par = round(source.dv01Par * (1 + (Math.random() * 0.04 - 0.02)))
      target.dv01Zero = round(source.dv01Zero! * (1 + (Math.random() * 0.05 - 0.025)))
    }
    const mvShift = round(source.notional * (Math.random() * 0.0001 - 0.00005))
    target.marketValue = round(source.marketValue + mvShift)
    target.pnl = round(source.pnl + mvShift)
    reasons.push("CURVE_STRIPPING")
  } else if (r < 0.55 && source.assetClass === "IR" && (source.typology === "Repo" || source.typology === "Buy_Sell_Back")) {
    target.pastCash = round(source.pastCash + source.notional * (Math.random() * 0.0002 - 0.0001))
    target.settledCash = round(source.settledCash + source.notional * (Math.random() * 0.0002 - 0.0001))
    target.pnl = round(target.marketValue + target.pastCash + target.futureCash)
    reasons.push("REPO_ACCRUAL")
  } else if (r < 0.65 && (source.assetClass === "FX" || source.assetClass === "EQ")) {
    // Vol surface change (options)
    if (source.typology.includes("Option") || source.typology.includes("Barrier") || source.typology.includes("Average")) {
      const mvShift = round(source.notional * (Math.random() * 0.002 - 0.001))
      target.marketValue = round(source.marketValue + mvShift)
      target.pnl = round(source.pnl + mvShift)
      if (source.fxVega !== null) target.fxVega = round(source.fxVega * (1 + (Math.random() * 0.15 - 0.075)))
      if (source.eqVega !== null) target.eqVega = round(source.eqVega * (1 + (Math.random() * 0.15 - 0.075)))
      if (source.fxTheta !== null) target.fxTheta = round(source.fxTheta * (1 + (Math.random() * 0.1 - 0.05)))
      if (source.eqTheta !== null) target.eqTheta = round(source.eqTheta * (1 + (Math.random() * 0.1 - 0.05)))
      reasons.push("VOL_SURFACE_INTERP")
      if (source.typology.includes("Barrier")) {
        const barrierShift = round(source.notional * (Math.random() * 0.003 - 0.0015))
        target.marketValue = round(target.marketValue + barrierShift)
        reasons.push("BARRIER_ENGINE")
      }
    } else {
      // Linear FX/EQ product - FX rate source
      if (source.assetClass === "FX") {
        target.fxDelta = round(source.fxDelta! * (1 + (Math.random() * 0.02 - 0.01)))
        const mvShift = round(source.notional * (Math.random() * 0.0005 - 0.00025))
        target.marketValue = round(source.marketValue + mvShift)
        target.pnl = round(source.pnl + mvShift)
        reasons.push("FX_RATE_SOURCE")
      } else {
        target.eqDelta = round(source.eqDelta! * (1 + (Math.random() * 0.01 - 0.005)))
        target.marketValue = round(source.marketValue + (Math.random() - 0.5) * 100)
        reasons.push("VOL_SURFACE_INTERP")
      }
    }
  } else if (r < 0.75 && source.assetClass === "FX" && source.typology === "Quanto") {
    const mvShift = round(source.notional * (Math.random() * 0.005 - 0.0025))
    target.marketValue = round(source.marketValue + mvShift)
    target.pnl = round(source.pnl + mvShift)
    if (source.fxDelta !== null) target.fxDelta = round(source.fxDelta * (1 + (Math.random() * 0.08 - 0.04)))
    reasons.push("QUANTO_CORR")
  } else if (r < 0.80 && source.assetClass === "COM") {
    // Commodity curve
    target.comDelta = round(source.comDelta! * (1 + (Math.random() * 0.06 - 0.03)))
    if (source.comVega !== null) target.comVega = round(source.comVega * (1 + (Math.random() * 0.04 - 0.02)))
    const mvShift = round(source.notional * (Math.random() * 0.001 - 0.0005))
    target.marketValue = round(source.marketValue + mvShift)
    target.pnl = round(source.pnl + mvShift)
    reasons.push("COMMODITY_CURVE")
  } else if (r < 0.88) {
    // Settlement date handling
    const cashShift = round(source.notional * (Math.random() * 0.001))
    target.pastCash = round(source.pastCash - cashShift)
    target.futureCash = round(source.futureCash + cashShift)
    target.pnl = round(target.marketValue + target.pastCash + target.futureCash)
    reasons.push("SETTLEMENT_DATE")
  } else if (r < 0.94) {
    // Theta calculation change
    if (source.fxTheta !== null) target.fxTheta = round(source.fxTheta * (1 + (Math.random() * 0.2 - 0.1)))
    if (source.eqTheta !== null) target.eqTheta = round(source.eqTheta * (1 + (Math.random() * 0.2 - 0.1)))
    const mvShift = round(source.notional * (Math.random() * 0.0002 - 0.0001))
    target.marketValue = round(source.marketValue + mvShift)
    target.pnl = round(source.pnl + mvShift)
    reasons.push("THETA_CALC")
  } else {
    // XVA model change
    const mvShift = round(source.notional * (Math.random() * 0.0008 - 0.0004))
    target.marketValue = round(source.marketValue + mvShift)
    target.pnl = round(source.pnl + mvShift)
    reasons.push("XVA_MODEL")
  }

  return { target, reasons }
}

// ── CSV Generation ──────────────────────────────────────────────────────

function tradeToCoreRow(t: Trade): Record<string, string> {
  return {
    trade_id: t.tradeId,
    portfolio: t.portfolio,
    counterparty: t.counterparty,
    typology: t.typology,
    asset_class: t.assetClass,
    currency: t.currency,
    notional: t.notional.toString(),
    trade_date: t.tradeDate,
    maturity_date: t.maturityDate,
    market_value: t.marketValue.toString(),
    past_cash: t.pastCash.toString(),
    future_cash: t.futureCash.toString(),
    future_pnl: t.futurePnl.toString(),
    settled_cash: t.settledCash.toString(),
    pnl: t.pnl.toString(),
  }
}

function tradeToSensiRow(t: Trade, assetClass: string): Record<string, string> | null {
  if (assetClass === "IR" && t.assetClass === "IR" && t.dv01Par !== null) {
    return {
      trade_id: t.tradeId, portfolio: t.portfolio, typology: t.typology,
      currency: t.currency, notional: t.notional.toString(),
      dv01_par: t.dv01Par.toString(), dv01_zero: t.dv01Zero!.toString(),
      ir_vega: (t.irVega ?? 0).toString(),
    }
  }
  if (assetClass === "EQ" && t.assetClass === "EQ" && t.eqDelta !== null) {
    return {
      trade_id: t.tradeId, portfolio: t.portfolio, typology: t.typology,
      currency: t.currency, notional: t.notional.toString(),
      eq_delta: t.eqDelta.toString(),
      eq_vega: (t.eqVega ?? 0).toString(),
      eq_theta: (t.eqTheta ?? 0).toString(),
    }
  }
  if (assetClass === "FX" && t.assetClass === "FX" && t.fxDelta !== null) {
    return {
      trade_id: t.tradeId, portfolio: t.portfolio, typology: t.typology,
      currency: t.currency, notional: t.notional.toString(),
      fx_delta: t.fxDelta.toString(),
      fx_vega: (t.fxVega ?? 0).toString(),
      fx_theta: (t.fxTheta ?? 0).toString(),
      fx_gamma: (t.fxGamma ?? 0).toString(),
    }
  }
  if (assetClass === "COM" && t.assetClass === "COM" && t.comDelta !== null) {
    return {
      trade_id: t.tradeId, portfolio: t.portfolio, typology: t.typology,
      currency: t.currency, notional: t.notional.toString(),
      com_delta: t.comDelta.toString(),
      com_vega: (t.comVega ?? 0).toString(),
    }
  }
  return null
}

function tradeToDownstreamRow(t: Trade, report: typeof DOWNSTREAM_REPORTS[number]): Record<string, string> {
  const base: Record<string, string> = {
    trade_id: t.tradeId,
    portfolio: t.portfolio,
    typology: t.typology,
    currency: t.currency,
  }

  // Different reports aggregate different metrics
  if (report.filePrefix.includes("pnl") || report.filePrefix.includes("gl") || report.filePrefix.includes("acct")) {
    base.market_value = t.marketValue.toString()
    base.pnl = t.pnl.toString()
    base.settled_cash = t.settledCash.toString()
  }
  if (report.filePrefix.includes("var") || report.filePrefix.includes("stress") || report.filePrefix.includes("frtb")) {
    base.market_value = t.marketValue.toString()
    if (t.dv01Par !== null) base.dv01 = t.dv01Par.toString()
    if (t.eqDelta !== null) base.eq_delta = t.eqDelta.toString()
    if (t.fxDelta !== null) base.fx_delta = t.fxDelta.toString()
    if (t.comDelta !== null) base.com_delta = t.comDelta.toString()
  }
  if (report.filePrefix.includes("dv01")) {
    base.dv01_par = (t.dv01Par ?? 0).toString()
    base.dv01_zero = (t.dv01Zero ?? 0).toString()
  }
  if (report.filePrefix.includes("sensi") || report.filePrefix.includes("greeks")) {
    if (t.fxDelta !== null) { base.fx_delta = t.fxDelta.toString(); base.fx_vega = (t.fxVega ?? 0).toString() }
    if (t.eqDelta !== null) { base.eq_delta = t.eqDelta.toString(); base.eq_vega = (t.eqVega ?? 0).toString() }
  }
  if (report.filePrefix.includes("risk") || report.filePrefix.includes("margin") || report.filePrefix.includes("position")) {
    base.market_value = t.marketValue.toString()
    base.notional = t.notional.toString()
  }
  if (report.filePrefix.includes("cva") || report.filePrefix.includes("fva")) {
    base.market_value = t.marketValue.toString()
    base.pnl = t.pnl.toString()
  }
  if (report.filePrefix.includes("exposure") || report.filePrefix.includes("lcr")) {
    base.market_value = t.marketValue.toString()
    base.notional = t.notional.toString()
    base.counterparty = t.counterparty
  }
  if (report.filePrefix.includes("gamma")) {
    if (t.fxGamma !== null) base.fx_gamma = t.fxGamma.toString()
    if (t.dv01Par !== null) base.dv01 = t.dv01Par.toString()
    if (t.eqDelta !== null) base.eq_delta = t.eqDelta.toString()
  }

  return base
}

function rowsToCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(headers.map(h => row[h] ?? "").join(","))
  }
  return lines.join("\n")
}

// ── Main Seed Function ──────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Starting seed data generation...")
  console.log(`   Generating ${TOTAL_TRADES} trades with ${Math.round(MATCH_RATE * 100)}% match rate\n`)

  // Step 1: Generate all trades
  console.log("📊 Generating trades...")
  const sourceTrades: Trade[] = []
  const targetTrades: Trade[] = []
  const breakReasons: Map<string, BreakReason[]> = new Map()

  for (let i = 0; i < TOTAL_TRADES; i++) {
    const source = generateSourceTrade(i)
    sourceTrades.push(source)

    if (Math.random() < MATCH_RATE) {
      // Perfect match
      targetTrades.push({ ...source })
    } else {
      // Apply break
      const { target, reasons } = applyBreak(source)
      targetTrades.push(target)
      breakReasons.set(source.tradeId, reasons)
    }
  }

  // Add a few missing trades (in source but not target, and vice versa)
  const missingInTarget = 15
  const missingInSource = 12
  // Remove last N from target
  for (let i = 0; i < missingInTarget; i++) {
    targetTrades.pop()
    const removedTrade = sourceTrades[TOTAL_TRADES - 1 - i]
    breakReasons.set(removedTrade.tradeId, ["TRADE_POPULATION"])
  }
  // Add extra trades to target
  for (let i = 0; i < missingInSource; i++) {
    const extraTrade = generateSourceTrade(TOTAL_TRADES + i)
    extraTrade.tradeId = `MX_NEW_${String(i + 1).padStart(4, "0")}`
    targetTrades.push(extraTrade)
  }

  const totalBreaks = breakReasons.size
  console.log(`   ✓ ${sourceTrades.length} source trades, ${targetTrades.length} target trades`)
  console.log(`   ✓ ${totalBreaks} breaks (${TOTAL_TRADES - totalBreaks} matches)\n`)

  // Print break reason distribution
  const reasonCounts: Record<string, number> = {}
  breakReasons.forEach((reasons) => {
    for (const r of reasons) {
      reasonCounts[r] = (reasonCounts[r] || 0) + 1
    }
  })
  console.log("   Break distribution:")
  for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${reason}: ${count}`)
  }
  console.log()

  // Step 2: Generate CSV content for all files
  console.log("📁 Generating CSV files...")

  // Core recon
  const coreSourceCSV = rowsToCSV(sourceTrades.map(tradeToCoreRow))
  const coreTargetCSV = rowsToCSV(targetTrades.map(tradeToCoreRow))

  // Sensitivity recons
  const sensiAssetClasses = ["IR", "EQ", "FX", "COM"] as const
  const sensiCSVs: Record<string, { source: string; target: string }> = {}
  for (const ac of sensiAssetClasses) {
    const sourceRows = sourceTrades.map(t => tradeToSensiRow(t, ac)).filter(Boolean) as Record<string, string>[]
    const targetRows = targetTrades.map(t => tradeToSensiRow(t, ac)).filter(Boolean) as Record<string, string>[]
    sensiCSVs[ac] = {
      source: rowsToCSV(sourceRows),
      target: rowsToCSV(targetRows),
    }
    console.log(`   ✓ ${ac} sensitivity: ${sourceRows.length} source rows, ${targetRows.length} target rows`)
  }

  // Downstream reports
  const downstreamCSVs: Record<string, { source: string; target: string }> = {}
  for (const report of DOWNSTREAM_REPORTS) {
    // Filter trades relevant to this report
    const relevantAssetClasses = report.dependsOn.includes("core") ? ["IR", "FX", "EQ", "COM"] :
      report.dependsOn.filter(d => d !== "core").map(d => d.replace("_sensi", "").toUpperCase())

    const relevantSource = sourceTrades.filter(t => relevantAssetClasses.includes(t.assetClass))
    const relevantTarget = targetTrades.filter(t => relevantAssetClasses.includes(t.assetClass))

    // Sample ~40% of trades for each report (not all trades go to all reports)
    const sampleRate = 0.3 + Math.random() * 0.3
    const sourceRows = relevantSource
      .filter(() => Math.random() < sampleRate)
      .map(t => tradeToDownstreamRow(t, report))
    const targetRows = relevantTarget
      .filter(() => Math.random() < sampleRate)
      .map(t => tradeToDownstreamRow(t, report))

    downstreamCSVs[report.filePrefix] = {
      source: rowsToCSV(sourceRows),
      target: rowsToCSV(targetRows),
    }
  }
  console.log(`   ✓ ${DOWNSTREAM_REPORTS.length} downstream reports generated\n`)

  // Step 3: Save CSV files to disk
  const dataDir = path.join(process.cwd(), "seed-data")
  const sourceDirCore = path.join(dataDir, "MX_3.1.58")
  const targetDirCore = path.join(dataDir, "MX_3.1.62")
  fs.mkdirSync(path.join(sourceDirCore, "core"), { recursive: true })
  fs.mkdirSync(path.join(targetDirCore, "core"), { recursive: true })
  fs.mkdirSync(path.join(sourceDirCore, "sensitivity"), { recursive: true })
  fs.mkdirSync(path.join(targetDirCore, "sensitivity"), { recursive: true })
  fs.mkdirSync(path.join(sourceDirCore, "downstream"), { recursive: true })
  fs.mkdirSync(path.join(targetDirCore, "downstream"), { recursive: true })

  fs.writeFileSync(path.join(sourceDirCore, "core", "core_recon_MX3158.csv"), coreSourceCSV)
  fs.writeFileSync(path.join(targetDirCore, "core", "core_recon_MX3162.csv"), coreTargetCSV)

  for (const ac of sensiAssetClasses) {
    fs.writeFileSync(path.join(sourceDirCore, "sensitivity", `${ac.toLowerCase()}_sensitivity_MX3158.csv`), sensiCSVs[ac].source)
    fs.writeFileSync(path.join(targetDirCore, "sensitivity", `${ac.toLowerCase()}_sensitivity_MX3162.csv`), sensiCSVs[ac].target)
  }

  for (const report of DOWNSTREAM_REPORTS) {
    fs.writeFileSync(path.join(sourceDirCore, "downstream", `${report.filePrefix}_MX3158.csv`), downstreamCSVs[report.filePrefix].source)
    fs.writeFileSync(path.join(targetDirCore, "downstream", `${report.filePrefix}_MX3162.csv`), downstreamCSVs[report.filePrefix].target)
  }
  console.log(`📂 CSV files saved to ${dataDir}/\n`)

  // Step 4: Seed the database
  console.log("🗄️  Seeding database...")

  // Create project
  const [project] = await db.insert(reconciliationProjectsTable).values({
    userId: SEED_USER_ID,
    name: "Murex MX 3.1.58 → 3.1.62 Upgrade",
    description: "Full regression reconciliation for Murex MX.3 upgrade from version 3.1.58 to 3.1.62. Covers core trade reconciliation, sensitivity reconciliation across all asset classes, and 25 downstream report reconciliations."
  }).returning()
  console.log(`   ✓ Project created: ${project.id}`)

  // Create explanation keys
  const expKeyIds: Record<string, string> = {}
  for (const ek of EXPLANATION_KEYS) {
    const [created] = await db.insert(explanationKeysTable).values({
      projectId: project.id,
      code: ek.code,
      label: ek.label,
      description: ek.description,
      color: ek.color,
      autoMatchPattern: ek.autoMatchPattern,
    }).returning()
    expKeyIds[ek.code] = created.id
  }
  console.log(`   ✓ ${EXPLANATION_KEYS.length} explanation keys created`)

  // Upload core files
  const [coreFileA] = await db.insert(uploadedFilesTable).values({
    projectId: project.id, uploaderId: SEED_USER_ID,
    filename: "core_recon_MX3158.csv", mimeType: "text/csv",
    size: Buffer.byteLength(coreSourceCSV), fileRole: "source_a",
    fileContent: coreSourceCSV,
    parsedHeaders: Object.keys(tradeToCoreRow(sourceTrades[0])),
    rowCount: sourceTrades.length,
  }).returning()

  const [coreFileB] = await db.insert(uploadedFilesTable).values({
    projectId: project.id, uploaderId: SEED_USER_ID,
    filename: "core_recon_MX3162.csv", mimeType: "text/csv",
    size: Buffer.byteLength(coreTargetCSV), fileRole: "source_b",
    fileContent: coreTargetCSV,
    parsedHeaders: Object.keys(tradeToCoreRow(targetTrades[0])),
    rowCount: targetTrades.length,
  }).returning()

  // Create core definition
  const [coreDef] = await db.insert(reconciliationDefinitionsTable).values({
    projectId: project.id,
    name: "Core Trade Reconciliation",
    description: "Trade-level comparison of market value, P&L, and cash components between MX 3.1.58 and MX 3.1.62",
    sourceAFileId: coreFileA.id,
    sourceBFileId: coreFileB.id,
    keyFields: [{ fieldA: "trade_id", fieldB: "trade_id" }, { fieldA: "portfolio", fieldB: "portfolio" }],
  }).returning()

  // Core field mappings
  const coreFields = [
    { a: "trade_id", b: "trade_id", type: "text", isKey: true },
    { a: "portfolio", b: "portfolio", type: "text", isKey: true },
    { a: "counterparty", b: "counterparty", type: "text", isKey: false },
    { a: "typology", b: "typology", type: "text", isKey: false },
    { a: "currency", b: "currency", type: "text", isKey: false },
    { a: "notional", b: "notional", type: "number", isKey: false, tolerance: "0.01" },
    { a: "market_value", b: "market_value", type: "number", isKey: false, tolerance: "0.01" },
    { a: "past_cash", b: "past_cash", type: "number", isKey: false, tolerance: "0.01" },
    { a: "future_cash", b: "future_cash", type: "number", isKey: false, tolerance: "0.01" },
    { a: "future_pnl", b: "future_pnl", type: "number", isKey: false, tolerance: "0.01" },
    { a: "settled_cash", b: "settled_cash", type: "number", isKey: false, tolerance: "0.01" },
    { a: "pnl", b: "pnl", type: "number", isKey: false, tolerance: "0.01" },
  ]
  for (let i = 0; i < coreFields.length; i++) {
    const f = coreFields[i]
    await db.insert(fieldMappingsTable).values({
      definitionId: coreDef.id,
      fieldNameA: f.a, fieldNameB: f.b,
      matcherType: f.type,
      tolerance: (f as any).tolerance ?? null,
      toleranceType: (f as any).tolerance ? "absolute" : null,
      isKey: f.isKey, sortOrder: i,
    })
  }
  console.log(`   ✓ Core definition created with ${coreFields.length} field mappings`)

  // Upload sensitivity files and create definitions
  const sensiDefIds: Record<string, string> = {}
  const sensiFieldConfigs: Record<string, Array<{ a: string; b: string; type: string; isKey: boolean; tolerance?: string }>> = {
    IR: [
      { a: "trade_id", b: "trade_id", type: "text", isKey: true },
      { a: "portfolio", b: "portfolio", type: "text", isKey: true },
      { a: "typology", b: "typology", type: "text", isKey: false },
      { a: "currency", b: "currency", type: "text", isKey: false },
      { a: "notional", b: "notional", type: "number", isKey: false, tolerance: "0.01" },
      { a: "dv01_par", b: "dv01_par", type: "number", isKey: false, tolerance: "0.5" },
      { a: "dv01_zero", b: "dv01_zero", type: "number", isKey: false, tolerance: "0.5" },
      { a: "ir_vega", b: "ir_vega", type: "number", isKey: false, tolerance: "1.0" },
    ],
    EQ: [
      { a: "trade_id", b: "trade_id", type: "text", isKey: true },
      { a: "portfolio", b: "portfolio", type: "text", isKey: true },
      { a: "typology", b: "typology", type: "text", isKey: false },
      { a: "currency", b: "currency", type: "text", isKey: false },
      { a: "notional", b: "notional", type: "number", isKey: false, tolerance: "0.01" },
      { a: "eq_delta", b: "eq_delta", type: "number", isKey: false, tolerance: "10" },
      { a: "eq_vega", b: "eq_vega", type: "number", isKey: false, tolerance: "5" },
      { a: "eq_theta", b: "eq_theta", type: "number", isKey: false, tolerance: "5" },
    ],
    FX: [
      { a: "trade_id", b: "trade_id", type: "text", isKey: true },
      { a: "portfolio", b: "portfolio", type: "text", isKey: true },
      { a: "typology", b: "typology", type: "text", isKey: false },
      { a: "currency", b: "currency", type: "text", isKey: false },
      { a: "notional", b: "notional", type: "number", isKey: false, tolerance: "0.01" },
      { a: "fx_delta", b: "fx_delta", type: "number", isKey: false, tolerance: "10" },
      { a: "fx_vega", b: "fx_vega", type: "number", isKey: false, tolerance: "5" },
      { a: "fx_theta", b: "fx_theta", type: "number", isKey: false, tolerance: "5" },
      { a: "fx_gamma", b: "fx_gamma", type: "number", isKey: false, tolerance: "1" },
    ],
    COM: [
      { a: "trade_id", b: "trade_id", type: "text", isKey: true },
      { a: "portfolio", b: "portfolio", type: "text", isKey: true },
      { a: "typology", b: "typology", type: "text", isKey: false },
      { a: "currency", b: "currency", type: "text", isKey: false },
      { a: "notional", b: "notional", type: "number", isKey: false, tolerance: "0.01" },
      { a: "com_delta", b: "com_delta", type: "number", isKey: false, tolerance: "10" },
      { a: "com_vega", b: "com_vega", type: "number", isKey: false, tolerance: "5" },
    ],
  }

  for (const ac of sensiAssetClasses) {
    const [fileA] = await db.insert(uploadedFilesTable).values({
      projectId: project.id, uploaderId: SEED_USER_ID,
      filename: `${ac.toLowerCase()}_sensitivity_MX3158.csv`, mimeType: "text/csv",
      size: Buffer.byteLength(sensiCSVs[ac].source), fileRole: "source_a",
      fileContent: sensiCSVs[ac].source,
      parsedHeaders: sensiFieldConfigs[ac].map(f => f.a),
      rowCount: sensiCSVs[ac].source.split("\n").length - 1,
    }).returning()

    const [fileB] = await db.insert(uploadedFilesTable).values({
      projectId: project.id, uploaderId: SEED_USER_ID,
      filename: `${ac.toLowerCase()}_sensitivity_MX3162.csv`, mimeType: "text/csv",
      size: Buffer.byteLength(sensiCSVs[ac].target), fileRole: "source_b",
      fileContent: sensiCSVs[ac].target,
      parsedHeaders: sensiFieldConfigs[ac].map(f => f.a),
      rowCount: sensiCSVs[ac].target.split("\n").length - 1,
    }).returning()

    const sensiName = ac === "IR" ? "IR Sensitivity (DV01/Vega)" :
      ac === "EQ" ? "Equity Sensitivity (Delta/Vega/Theta)" :
      ac === "FX" ? "FX Sensitivity (Delta/Vega/Theta/Gamma)" :
      "Commodity Sensitivity (Delta/Vega)"

    const [sensiDef] = await db.insert(reconciliationDefinitionsTable).values({
      projectId: project.id,
      name: sensiName,
      description: `${ac} sensitivity reconciliation for MX 3.1.58 → 3.1.62 upgrade`,
      sourceAFileId: fileA.id, sourceBFileId: fileB.id,
      keyFields: [{ fieldA: "trade_id", fieldB: "trade_id" }, { fieldA: "portfolio", fieldB: "portfolio" }],
    }).returning()

    for (let i = 0; i < sensiFieldConfigs[ac].length; i++) {
      const f = sensiFieldConfigs[ac][i]
      await db.insert(fieldMappingsTable).values({
        definitionId: sensiDef.id,
        fieldNameA: f.a, fieldNameB: f.b,
        matcherType: f.type,
        tolerance: f.tolerance ?? null,
        toleranceType: f.tolerance ? "absolute" : null,
        isKey: f.isKey, sortOrder: i,
      })
    }

    sensiDefIds[`${ac.toLowerCase()}_sensi`] = sensiDef.id
    console.log(`   ✓ ${ac} sensitivity definition created`)
  }

  // Upload downstream report files and create definitions
  const downstreamDefIds: Record<string, string> = {}
  for (const report of DOWNSTREAM_REPORTS) {
    const csvSource = downstreamCSVs[report.filePrefix].source
    const csvTarget = downstreamCSVs[report.filePrefix].target
    if (!csvSource || !csvTarget) continue

    const headers = csvSource.split("\n")[0].split(",")

    const [fileA] = await db.insert(uploadedFilesTable).values({
      projectId: project.id, uploaderId: SEED_USER_ID,
      filename: `${report.filePrefix}_MX3158.csv`, mimeType: "text/csv",
      size: Buffer.byteLength(csvSource), fileRole: "source_a",
      fileContent: csvSource,
      parsedHeaders: headers,
      rowCount: csvSource.split("\n").length - 1,
    }).returning()

    const [fileB] = await db.insert(uploadedFilesTable).values({
      projectId: project.id, uploaderId: SEED_USER_ID,
      filename: `${report.filePrefix}_MX3162.csv`, mimeType: "text/csv",
      size: Buffer.byteLength(csvTarget), fileRole: "source_b",
      fileContent: csvTarget,
      parsedHeaders: headers,
      rowCount: csvTarget.split("\n").length - 1,
    }).returning()

    const [dsDef] = await db.insert(reconciliationDefinitionsTable).values({
      projectId: project.id,
      name: `${report.name} (${report.dept})`,
      description: `Downstream ${report.dept} report: ${report.name}. Depends on: ${report.dependsOn.join(", ")}`,
      sourceAFileId: fileA.id, sourceBFileId: fileB.id,
      keyFields: [{ fieldA: "trade_id", fieldB: "trade_id" }, { fieldA: "portfolio", fieldB: "portfolio" }],
    }).returning()

    // Create basic field mappings
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      const isNumeric = ["market_value", "pnl", "settled_cash", "notional", "dv01", "dv01_par", "dv01_zero",
        "eq_delta", "eq_vega", "fx_delta", "fx_vega", "fx_gamma", "com_delta", "com_vega"].includes(h)
      await db.insert(fieldMappingsTable).values({
        definitionId: dsDef.id,
        fieldNameA: h, fieldNameB: h,
        matcherType: isNumeric ? "number" : "text",
        tolerance: isNumeric ? "0.01" : null,
        toleranceType: isNumeric ? "absolute" : null,
        isKey: h === "trade_id" || h === "portfolio",
        sortOrder: i,
      })
    }

    downstreamDefIds[report.filePrefix] = dsDef.id
  }
  console.log(`   ✓ ${DOWNSTREAM_REPORTS.length} downstream definitions created`)

  // Create dependency edges
  const coreDefId = coreDef.id

  // Core → sensitivity definitions (core is parent of all sensitivities)
  for (const ac of sensiAssetClasses) {
    const sensiId = sensiDefIds[`${ac.toLowerCase()}_sensi`]
    // Both core and sensi are roots, but sensi depends on core for explanation propagation
    // Actually core and sensi are siblings at the root level
  }

  // Sensitivity definitions → downstream reports
  for (const report of DOWNSTREAM_REPORTS) {
    for (const dep of report.dependsOn) {
      let parentId: string | undefined
      if (dep === "core") parentId = coreDefId
      else parentId = sensiDefIds[dep]

      if (parentId && downstreamDefIds[report.filePrefix]) {
        await db.insert(dependencyEdgesTable).values({
          projectId: project.id,
          parentDefinitionId: parentId,
          childDefinitionId: downstreamDefIds[report.filePrefix],
          propagationRule: {
            fieldMappings: [
              { parentField: "trade_id", childField: "trade_id" },
              { parentField: "portfolio", childField: "portfolio" },
            ],
          },
        })
      }
    }
  }
  console.log(`   ✓ Dependency edges created\n`)

  // Step 5: Create regression cycle and run core recon
  console.log("🔄 Creating regression cycle...")
  const [cycle] = await db.insert(regressionCyclesTable).values({
    projectId: project.id,
    name: "Cycle 1 - Initial Comparison",
    status: "completed",
    startedAt: new Date(),
    completedAt: new Date(),
    metadata: { description: "First pass reconciliation of MX 3.1.58 → 3.1.62 upgrade" },
  }).returning()
  console.log(`   ✓ Cycle created: ${cycle.id}`)

  // Run the core reconciliation and save results
  console.log("⚡ Running core reconciliation (this may take a moment)...")
  const { runReconciliation } = await import("../lib/recon/engine")
  const { parseCSV } = await import("../lib/recon/parsers/csv-parser")

  const parsedSource = parseCSV(coreSourceCSV)
  const parsedTarget = parseCSV(coreTargetCSV)

  const reconOutput = runReconciliation(parsedSource, parsedTarget, {
    keyFields: [{ fieldA: "trade_id", fieldB: "trade_id" }],
    fieldMappings: coreFields.map(f => ({
      fieldNameA: f.a, fieldNameB: f.b,
      matcherType: f.type,
      tolerance: f.tolerance ? parseFloat(f.tolerance) : undefined,
      toleranceType: f.tolerance ? "absolute" : undefined,
    })),
    // Explanation keys are no longer auto-applied during recon
    // autoApplyKeys: false (default)
  })

  console.log(`   ✓ Reconciliation complete:`)
  console.log(`     Total: ${reconOutput.summary.totalRows}`)
  console.log(`     Matched: ${reconOutput.summary.matched}`)
  console.log(`     Breaks: ${reconOutput.summary.breaks}`)
  console.log(`     Missing A: ${reconOutput.summary.missingA}`)
  console.log(`     Missing B: ${reconOutput.summary.missingB}`)
  console.log(`     Explained: ${reconOutput.summary.explained}`)
  console.log(`     Unexplained: ${reconOutput.summary.unexplained}\n`)

  // Save run record
  const [run] = await db.insert(reconciliationRunsTable).values({
    cycleId: cycle.id,
    definitionId: coreDef.id,
    status: "completed",
    summary: reconOutput.summary,
    startedAt: new Date(Date.now() - 30000),
    completedAt: new Date(),
  }).returning()

  // Save results in batches
  console.log("💾 Saving results to database (batched)...")
  const BATCH = 500
  const fieldMappingIds = await db.select().from(fieldMappingsTable).where(
    require("drizzle-orm").eq(fieldMappingsTable.definitionId, coreDef.id)
  )
  const fmIdMap = new Map<string, string>()
  for (const fm of fieldMappingIds) {
    fmIdMap.set(fm.fieldNameA, fm.id)
  }

  let savedCount = 0
  for (let i = 0; i < reconOutput.results.length; i += BATCH) {
    const batch = reconOutput.results.slice(i, i + BATCH)
    const inserted = await db.insert(reconciliationResultsTable).values(
      batch.map(r => ({
        runId: run.id,
        rowKeyValue: r.keyValue,
        sourceARowIndex: r.sourceARowIndex,
        sourceBRowIndex: r.sourceBRowIndex,
        status: r.status,
        explanationKeyId: r.explanationKeyId ?? null,
        aiExplanation: r.explanationReason ?? null,
        isPropagated: false,
      }))
    ).returning({ id: reconciliationResultsTable.id })

    // Save field details
    const allDetails: any[] = []
    for (let j = 0; j < batch.length; j++) {
      const result = batch[j]
      const resultId = inserted[j]?.id
      if (!resultId || result.fields.length === 0) continue
      for (const field of result.fields) {
        const mappingId = fmIdMap.get(field.fieldNameA)
        if (!mappingId) continue
        allDetails.push({
          resultId,
          fieldMappingId: mappingId,
          valueA: field.valueA,
          valueB: field.valueB,
          numericDiff: field.matcherResult.numericDiff?.toString() ?? null,
          isMatch: field.isMatch,
          matcherOutput: field.matcherResult,
        })
      }
    }
    if (allDetails.length > 0) {
      for (let k = 0; k < allDetails.length; k += BATCH) {
        await db.insert(resultFieldDetailsTable).values(allDetails.slice(k, k + BATCH))
      }
    }
    savedCount += batch.length
    if (savedCount % 2000 === 0 || savedCount === reconOutput.results.length) {
      process.stdout.write(`   💾 ${savedCount}/${reconOutput.results.length} results saved\r`)
    }
  }
  console.log(`\n   ✓ All results saved to database\n`)

  console.log("✅ Seed complete!")
  console.log(`\n   Project: "${project.name}"`)
  console.log(`   Project ID: ${project.id}`)
  console.log(`   Files: ${2 + sensiAssetClasses.length * 2 + DOWNSTREAM_REPORTS.length * 2} total`)
  console.log(`   Definitions: ${1 + sensiAssetClasses.length + DOWNSTREAM_REPORTS.length} total`)
  console.log(`   Explanation Keys: ${EXPLANATION_KEYS.length}`)
  console.log(`   Cycle: "${cycle.name}" (core recon executed)`)
  console.log(`\n   CSV files also saved to: ${dataDir}/`)
  console.log(`   Use the Folder Scanner in the UI to import sensitivity and downstream files\n`)

  await client.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
