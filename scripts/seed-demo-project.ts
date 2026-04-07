/**
 * Create a clean demo project for AI feature demonstrations.
 *
 * Unlike the main seed, this creates explanation keys WITHOUT auto-match
 * patterns so that results start completely unassigned — perfect for
 * demonstrating how AI identifies patterns and suggests keys.
 *
 * Run: npx tsx scripts/seed-demo-project.ts
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { reconciliationProjectsTable } from "../db/schema/projects-schema"
import { explanationKeysTable } from "../db/schema/explanation-keys-schema"

const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error("DATABASE_URL not set. Pass it as env var.")
  process.exit(1)
}

const client = postgres(connectionString)
const db = drizzle(client)

const SEED_USER_ID = process.env.SEED_USER_ID || "user_3BzQhhEIkF9GxlLuLgP5hXNCW52"

async function seed() {
  console.log("\n🎭 Creating clean AI demo project...\n")

  // Create project
  const [project] = await db.insert(reconciliationProjectsTable).values({
    userId: SEED_USER_ID,
    name: "AI Demo — MX Upgrade Recon",
    description: "Clean demo project for showcasing AI features. Explanation keys have no auto-match patterns — all assignment starts blank so AI can demonstrate its analysis capabilities."
  }).returning()

  console.log(`  ✓ Project: ${project.name} (${project.id})`)

  // Create explanation keys WITHOUT auto-match patterns
  const keys = [
    { code: "BOOTSTRAP_METHOD", label: "IR Curve Bootstrap Methodology Change", color: "#3b82f6",
      description: "MX 3.1.62 uses improved piecewise cubic Hermite interpolation for IR curve bootstrapping. Affects DV01 and market values on IR products." },
    { code: "VOL_SURFACE_INTERP", label: "Volatility Surface Interpolation Change", color: "#8b5cf6",
      description: "Upgraded vol surface uses SABR interpolation instead of cubic spline between strikes. Impacts vega and option market values." },
    { code: "DAYCOUNT_CONV", label: "Day Count Convention Correction", color: "#f59e0b",
      description: "Fixed ACT/365.25 to ACT/365F for GBP products per ISDA 2024 guidance. Affects accrued interest and P&L." },
    { code: "FX_RATE_SOURCE", label: "FX Fixing Source Change", color: "#06b6d4",
      description: "ECB fixing rates replaced with WMR 4pm fixing for non-EUR crosses." },
    { code: "SETTLEMENT_DATE", label: "Settlement Date Handling Fix", color: "#10b981",
      description: "Corrected T+2 settlement calendar for APAC holidays. Affects cash timing between past_cash and future_cash." },
    { code: "ROUNDING_PRECISION", label: "Rounding Precision Increase", color: "#6b7280",
      description: "Internal calculation precision increased from 8 to 12 decimal places. Causes sub-cent differences." },
    { code: "BARRIER_ENGINE", label: "Barrier Option Pricing Engine Upgrade", color: "#ef4444",
      description: "New Monte Carlo barrier engine with variance reduction. Affects barrier option MV and Greeks significantly." },
    { code: "CURVE_STRIPPING", label: "OIS Discounting Curve Stripping", color: "#ec4899",
      description: "Multi-curve framework updated: OIS-SOFR spread recalibrated post-LIBOR transition." },
    { code: "THETA_CALC", label: "Theta Calculation Method Change", color: "#a855f7",
      description: "Theta now computed with sticky delta rather than sticky strike." },
    { code: "DATA_QUALITY", label: "Data Quality / Unknown Issue", color: "#78716c",
      description: "Break that doesn't fit any known upgrade pattern. May indicate data quality issues or missing market data." },
  ]

  for (const k of keys) {
    await db.insert(explanationKeysTable).values({
      projectId: project.id,
      code: k.code,
      label: k.label,
      description: k.description,
      color: k.color,
      autoMatchPattern: null, // NO auto-match — AI does the work
    })
  }

  console.log(`  ✓ ${keys.length} explanation keys (NO auto-match patterns)`)

  console.log(`
✅ Demo project ready!

   Project: "${project.name}"
   Project ID: ${project.id}
   Keys: ${keys.length} (all blank — no auto-assignment)

Next steps:
  1. Open the project in the app
  2. Go to Definitions → New Recon Template
  3. Upload files from demo-data/01_break_pattern_analyst/
  4. Auto-detect columns, set trade_id as key
  5. Name it, save, then Run Now
  6. Results will show ALL breaks as unassigned
  7. Click "AI Break Analysis" to demonstrate AI clustering
  8. Click "Apply All Suggestions" to show batch assignment
`)

  await client.end()
  process.exit(0)
}

seed().catch(err => {
  console.error("Failed:", err)
  process.exit(1)
})
