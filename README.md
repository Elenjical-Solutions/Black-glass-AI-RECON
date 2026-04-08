# Black Glass AI RECON

**Smart Dependency Reconciliation Tool** by [Elenjical Solutions](https://github.com/Elenjical-Solutions)

An AI-powered reconciliation platform for financial markets. Built for system upgrade scenarios (e.g., Murex MX.3 version upgrades), it compares before/after data across core trades, sensitivities, and downstream reports — with intelligent dependency tracking that propagates explanations through the entire reporting chain.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Workflow: 5 Phases](#workflow-5-phases)
- [AI Features](#ai-features)
  - [1. Discover Patterns](#1-discover-patterns)
  - [2. Apply My Rules (NLR)](#2-apply-my-rules-nlr)
  - [3. AI Field Mapping](#3-ai-field-mapping)
  - [4. AI Key Suggestion per Row](#4-ai-key-suggestion-per-row)
  - [5. AI Dependency Suggestion](#5-ai-dependency-suggestion)
- [Explanation Keys](#explanation-keys)
  - [Natural Language Rules](#natural-language-rules)
  - [Auto-Match Patterns](#auto-match-patterns)
  - [Multi-Key Assignment](#multi-key-assignment)
  - [Pre-Configured Keys](#pre-configured-keys)
- [Running the Demos](#running-the-demos)
  - [Demo 1: Discover Patterns](#demo-1-discover-patterns)
  - [Demo 2: AI Field Mapping](#demo-2-ai-field-mapping)
  - [Demo 3: Natural Language Rule Assignment](#demo-3-natural-language-rule-assignment)
  - [Demo 4: Dependency Suggestion](#demo-4-dependency-suggestion)
  - [Demo 5: Full End-to-End](#demo-5-full-end-to-end)
- [Demo Data Reference](#demo-data-reference)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Project Structure](#project-structure)

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/Elenjical-Solutions/Black-glass-AI-RECON.git
cd Black-glass-AI-RECON
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL, Clerk keys, and ANTHROPIC_API_KEY

# 3. Push database schema
DATABASE_URL="your-url" npx drizzle-kit push

# 4. Create a clean demo project (explanation keys with NO auto-match — ideal for demos)
npx tsx scripts/seed-demo-project.ts

# 5. Generate demo data files
npx tsx scripts/generate-demo-data.ts
npx tsx scripts/generate-nlr-demo.ts

# 6. Start the app
npm run dev
# Open http://localhost:3000
```

---

## Core Concepts

| Concept | What It Is | Example |
|---------|-----------|---------|
| **Project** | A workspace for one reconciliation exercise | "Murex MX 3.1.58 → 3.1.62 Upgrade" |
| **File** | A CSV/XML data extract (Source A = old, Source B = new) | `core_recon_MX3158.csv` |
| **Recon Template** | Reusable config: field mappings, match rules, tolerances | "Core Trade Recon" with 15 mapped fields |
| **Explanation Key** | A tag for a known difference cause, with optional NL rule | `BOOTSTRAP_METHOD` — "IR curve bootstrap changed" |
| **Dependency Edge** | Links an upstream recon to a downstream report | Core Recon → Daily P&L Report |
| **Cycle** | A regression run — executes templates against file pairs | "Cycle 1 — Initial Comparison" |
| **Run** | One template executed against two files | 8,001 matched, 1,984 breaks |

**Key insight:** Templates are reusable — define field mappings once, run against different files in every cycle. Explanation keys and their NL rules persist across all cycles.

---

## Workflow: 5 Phases

The app has an interactive guide at **`/dashboard/guide`** with expandable details for each step.

### Phase 1: Setup
1. **Create a project** → Dashboard → Projects → New
2. **Upload files** → Source A (old system) + Source B (new system)
3. **Create a recon template** → 3-step wizard: select files → auto-detect columns → map fields → name & save
4. **Run the reconciliation** → Definition page → "Run Now" → pick files → go

### Phase 2: Discover
5. **Click "Discover Patterns"** on the results page → AI clusters all breaks by similarity
6. This is **analysis only** — it does NOT assign keys. It tells you what patterns exist.

### Phase 3: Define
7. **Go to Explanation Keys** → create/edit keys
8. **Write natural language rules** for each key based on what you discovered
9. Rules persist across all future cycles in this project

### Phase 4: Apply
10. **Click "Apply My Rules"** on the results page → AI reads your NL rules and assigns keys
11. Multiple keys per break supported (e.g., BOOTSTRAP_METHOD + DAYCOUNT_CONV)
12. Each assignment includes confidence % and per-field reasoning
13. **Export to CSV** for offline review

### Phase 5: Repeat
14. **Next cycle** → upload new files → run same template → click "Apply My Rules" → done in minutes
15. **Propagate** → push explanation keys from core/sensitivity to downstream reports
16. Only investigate NEW patterns that don't match existing rules

> **First cycle: ~2 hours** (discover + write rules). **Every subsequent cycle: ~2 minutes** (upload + run + apply).

---

## AI Features

### 1. Discover Patterns
**Where:** Results page → **"Discover Patterns"** button

Pure analysis — clusters breaks by similarity without assigning keys.

- Identifies groups like "30 IR trades where DV01 shifted 2-5%"
- Per-field evidence: which fields changed, direction, magnitude
- Flags anomalies that don't fit any cluster
- **Does NOT assign keys** — this is for understanding your data

### 2. Apply My Rules (NLR)
**Where:** Results page → **"Apply My Rules"** button

Reads your natural language rules on explanation keys and assigns them to breaks.

- Evaluates each break against ALL your rules
- Assigns **multiple keys** per break when applicable
- Each assignment has confidence % and per-field reasoning
- Stores in the multi-key junction table (`result_explanation_keys`)

**The difference from Discover Patterns:**
- Discover Patterns = "I don't know what's happening — AI, what patterns do you see?"
- Apply My Rules = "I've written rules — AI, read MY rules and apply them"

### 3. AI Field Mapping
**Where:** Definition wizard → Step 1 → **"AI Suggest Mappings"** button

When column names differ between systems, AI maps them using financial domain knowledge:
- `MtM_Value` → `mark_to_market`
- `Counterparty_Code` → `cpty`
- `DV01_Par_Sens` → `ir_sensitivity_bp`

### 4. AI Key Suggestion per Row
**Where:** Results table → sparkles icon on each unassigned break row

Click to get a per-row suggestion with confidence and reasoning:
> "DV01_par shifted from 1234.5 to 1271.2 (3% increase), market_value moved proportionally. This matches BOOTSTRAP_METHOD. Confidence: 92%."

### 5. AI Dependency Suggestion
**Where:** Dependencies tab → select a downstream definition → **"AI Suggest Dependencies"**

AI analyzes a downstream report's columns and identifies which core/sensitivity recons it depends on:
> "This report contains dv01_par and fx_delta → depends on Core Recon + IR Sensitivity + FX Sensitivity."

---

## Explanation Keys

### Natural Language Rules

The primary way to define when a key should apply. Write rules in plain English:

> "For interest rate products (IRS, Bond, Deposit) where DV01 has shifted by 2-5% and market value moved proportionally, this is caused by the IR curve bootstrap methodology change from linear on zero rates to piecewise cubic Hermite interpolation."

Rules can reference:
- Product types (IRS, FX_Option, Barrier)
- Currencies (GBP, EUR)
- Field names and magnitudes (dv01_par shifted 2-5%)
- Combinations of conditions (DV01 shifted AND MV proportional AND currency is GBP)

### Auto-Match Patterns

Optional deterministic rules (under "Advanced" in the edit form). Only work on a **single field**:
- Field name: `market_value`
- Diff range: -500 to 500

For multi-field conditions, use natural language rules instead.

### Multi-Key Assignment

A single break can have multiple explanation keys. Example: a GBP IRS trade might have:
- `BOOTSTRAP_METHOD` — because DV01 shifted 3.5%
- `DAYCOUNT_CONV` — because PnL has a tiny GBP-specific diff

Both keys appear as colored badges on the row. Hover for full label.

### Pre-Configured Keys

The demo project includes 10 keys with natural language rules:

| Code | What It Detects |
|------|----------------|
| `BOOTSTRAP_METHOD` | DV01 shifted 2-5% on IR products, MV proportional |
| `VOL_SURFACE_INTERP` | Vega shifted 8-15% on options, theta 3-8% |
| `DAYCOUNT_CONV` | Tiny PnL diff on GBP products (<0.01% notional) |
| `FX_RATE_SOURCE` | FX delta shifted 0.5-2% on FX products |
| `SETTLEMENT_DATE` | Zero-sum cash shift (settled↓ = future↑), MV unchanged |
| `ROUNDING_PRECISION` | All diffs < $0.05, any product |
| `BARRIER_ENGINE` | Large MV change (>0.5% notional) on barrier options |
| `CURVE_STRIPPING` | DV01 1-3%, zero DV01 shifts more than par |
| `THETA_CALC` | Theta shifted 5-20%, delta/vega stable |
| `DATA_QUALITY` | Huge MV diff with no sensitivity correlation |

---

## Running the Demos

All demo data is in the `demo-data/` folder. Each subfolder has a README with detailed instructions.

### Prerequisites

1. App running (`npm run dev`)
2. Demo project created (`npx tsx scripts/seed-demo-project.ts`)
3. Demo files generated (`npx tsx scripts/generate-demo-data.ts` and `npx tsx scripts/generate-nlr-demo.ts`)

### Demo 1: Discover Patterns

**Shows:** AI clustering breaks by similarity — pure discovery, no key assignment.

**Files:** `demo-data/01_break_pattern_analyst/`

| Step | Action |
|------|--------|
| 1 | Open **"AI Demo — MX Upgrade Recon"** project |
| 2 | Go to **Definitions → New Recon Template** |
| 3 | Upload `source_MX3158.csv` (Source A) and `target_MX3162.csv` (Source B) |
| 4 | Click **"Auto-Detect Columns & Map"** |
| 5 | Mark `trade_id` as key field (checkbox) |
| 6 | Name: "Pattern Discovery Demo", Category: Core, click **Create** |
| 7 | On definition page, scroll to **Run Now** → select the files → click **Run** |
| 8 | On results page: ~95 breaks, all unassigned |
| 9 | Click **"Discover Patterns"** |
| 10 | AI shows clusters: IR DV01 shifts, option vega changes, rounding, anomalies |

**What to highlight:** AI found 4-5 distinct patterns across 500 trades without any prior rules. Expand each cluster to see per-field evidence.

### Demo 2: AI Field Mapping

**Shows:** AI mapping columns with completely different names between systems.

**Files:** `demo-data/02_ai_field_mapping/`

| Step | Action |
|------|--------|
| 1 | Open any project → **Definitions → New Recon Template** |
| 2 | Upload `murex_extract_MX3158.csv` (Source A) and `risk_system_extract.csv` (Source B) |
| 3 | Note: column names are completely different (`TradeRef` vs `deal_id`, `MtM_Value` vs `mark_to_market`) |
| 4 | Click **"AI Suggest Mappings"** |
| 5 | AI maps all 13 columns correctly using financial domain knowledge |

**What to highlight:** The AI knows that `MtM_Value` = `mark_to_market`, `Counterparty_Code` = `cpty`, `DV01_Par_Sens` = `ir_sensitivity_bp`. No configuration needed.

### Demo 3: Natural Language Rule Assignment

**Shows:** Writing rules in plain English, then AI applying them — including multi-key assignment.

**Files:** `demo-data/05_nlr_assignment/`

| Step | Action |
|------|--------|
| 1 | Open **"AI Demo — MX Upgrade Recon"** project |
| 2 | Verify explanation keys have NL rules (Explanation Keys tab — "AI Rule" column should show text) |
| 3 | Go to **Definitions → New Recon Template** |
| 4 | Upload `nlr_source_MX3158.csv` and `nlr_target_MX3162.csv` |
| 5 | Auto-detect columns, mark `trade_id` as key |
| 6 | Name: "NLR Demo", save and **Run Now** |
| 7 | Results: **56 breaks, ALL unassigned** (no auto-match patterns fire) |
| 8 | Click **"Apply My Rules"** |
| 9 | AI reads all 10 NL rules and assigns keys to each break |
| 10 | Some trades show **two colored badges** (multi-key: BOOTSTRAP + DAYCOUNT) |

**What to highlight:**
- All 56 breaks assigned in one click
- Multiple keys per trade (look for rows with 2 badges)
- Expand rows to see AI's per-field reasoning
- The `answer_key.csv` file can be used to verify AI correctness

### Demo 4: Dependency Suggestion

**Shows:** AI analyzing columns to suggest upstream dependencies for downstream reports.

**Files:** `demo-data/04_dependency_suggestion/`

| Step | Action |
|------|--------|
| 1 | Create definitions for: Core Recon, IR Sensitivity, EQ Sensitivity, FX Sensitivity, COM Sensitivity |
| 2 | Upload each downstream report pair (Finance P&L, VaR, EQ Greeks, FRTB, Commodity Risk) |
| 3 | Create definitions for each downstream report |
| 4 | Go to **Dependencies** tab → select a downstream definition |
| 5 | In the right panel, click **"AI Suggest Dependencies"** |
| 6 | AI recommends: "VaR Report contains dv01_par and fx_delta → depends on Core + IR + FX" |
| 7 | Click **Accept** to create dependency edges |

### Demo 5: Full End-to-End

**Shows:** The complete workflow from upload to propagation.

**Files:** `test-data/` (7 file pairs: core, IR/EQ/FX sensitivities, daily P&L, VaR, FRTB)

| Step | Action |
|------|--------|
| 1 | Create a new project |
| 2 | Upload all 14 test files (7 Source A + 7 Source B) |
| 3 | Create 7 recon templates (core + 3 sensitivities + 3 downstream) |
| 4 | Create a cycle, run all templates |
| 5 | On the core recon results: click **Discover Patterns** |
| 6 | Go to Explanation Keys → write NL rules based on discoveries |
| 7 | Go back to core results → click **Apply My Rules** |
| 8 | Set up dependency edges (core → downstream reports) |
| 9 | Click **Propagate All** on the cycle |
| 10 | Check downstream reports — keys propagated from core |
| 11 | **Export** results to CSV |

---

## Demo Data Reference

### Generated Files

| Folder | Files | Purpose | Script |
|--------|-------|---------|--------|
| `demo-data/01_break_pattern_analyst/` | 2 CSVs (500 trades) | Clustered patterns for Discover Patterns | `generate-demo-data.ts` |
| `demo-data/02_ai_field_mapping/` | 2 CSVs (100 trades) | Different column names for AI mapping | `generate-demo-data.ts` |
| `demo-data/03_smart_key_suggestion/` | 2 CSVs (50 trades) | Per-row key suggestion | `generate-demo-data.ts` |
| `demo-data/04_dependency_suggestion/` | 12 CSVs (5 reports) | Dependency analysis | `generate-demo-data.ts` |
| `demo-data/05_nlr_assignment/` | 2 CSVs + answer key (76 trades) | NLR rule assignment + multi-key | `generate-nlr-demo.ts` |
| `test-data/` | 14 CSVs (50-200 rows each) | Manual testing, openable in Excel | `generate-test-files.ts` |

### Seeded Database

| Script | What It Creates |
|--------|----------------|
| `npm run seed` | 10K trades, 30 definitions, 14 keys (WITH auto-match), dependency tree, executed core recon |
| `npx tsx scripts/seed-demo-project.ts` | Clean demo project, 10 keys (NO auto-match, WITH NL rules) — ideal for demos |

### Regenerating

```bash
# Regenerate all demo files
npx tsx scripts/generate-demo-data.ts
npx tsx scripts/generate-nlr-demo.ts
npx tsx scripts/generate-test-files.ts

# Reseed the database
npm run seed                              # Full 10K seed
npx tsx scripts/seed-demo-project.ts      # Clean demo project
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | Shadcn/UI + Tailwind CSS 4 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |
| AI | Claude API (@anthropic-ai/sdk) |
| Graph Viz | React Flow (@xyflow/react) |
| Tables | @tanstack/react-table |
| File Parsing | papaparse (CSV) + fast-xml-parser (XML) |

---

## Environment Variables

Create `.env.local`:

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Clerk Authentication (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Claude AI (https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514

# Optional
AI_CACHE_TTL_HOURS=24
RECON_CHUNK_SIZE=5000
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run seed` | Seed DB with 10K Murex trades |
| `npm run db:push` | Push Drizzle schema to PostgreSQL |
| `npx tsx scripts/seed-demo-project.ts` | Create clean demo project (no auto-match) |
| `npx tsx scripts/generate-test-files.ts` | Generate small test CSVs |
| `npx tsx scripts/generate-demo-data.ts` | Generate AI feature demo data |
| `npx tsx scripts/generate-nlr-demo.ts` | Generate NLR assignment demo data |

---

## Project Structure

```
black-glass-ai-recon/
├── app/
│   ├── dashboard/
│   │   ├── guide/                # Interactive workflow guide (10 steps)
│   │   ├── projects/
│   │   │   └── [projectId]/      # Project detail (8 tabs)
│   │   │       ├── files/        # File upload & preview
│   │   │       ├── folders/      # Folder scanner & auto-import
│   │   │       ├── definitions/  # Recon template wizard + Run Now
│   │   │       ├── dependencies/ # 3-panel command center
│   │   │       ├── explanation-keys/ # Keys with NL rules
│   │   │       ├── cycles/       # Regression cycles + results
│   │   │       └── screenshots/  # Visual comparison
│   │   └── settings/             # Account management (Clerk)
│   ├── sign-in/ & sign-up/      # Clerk authentication
├── actions/                      # Server actions
│   ├── ai-actions.ts             # 5 AI features + NLR assignment
│   ├── runs-actions.ts           # Run execution (files per-run)
│   └── dependency-actions.ts     # Graph, lineage, propagation
├── components/
│   ├── ai/                       # AI UI components
│   │   ├── break-analysis-panel.tsx  # Discover Patterns
│   │   ├── key-suggestion-inline.tsx # Per-row suggestion
│   │   └── dependency-suggestion-panel.tsx
│   ├── dependency/               # 3-panel command center
│   └── ui/                       # Shadcn/UI components
├── lib/
│   ├── recon/                    # Core reconciliation engine
│   │   ├── engine.ts             # Orchestrator
│   │   ├── matchers/             # Text/Number/Date/Regex
│   │   └── parsers/              # CSV/XML
│   ├── ai/                       # Claude API integration
│   └── streaming/                # Chunked processing (100K+ rows)
├── db/schema/                    # 13 Drizzle ORM tables
├── scripts/                      # Seed & demo data generators
├── test-data/                    # Small test CSVs (50-200 rows)
└── demo-data/                    # 5 AI feature demo folders
    ├── 01_break_pattern_analyst/
    ├── 02_ai_field_mapping/
    ├── 03_smart_key_suggestion/
    ├── 04_dependency_suggestion/
    └── 05_nlr_assignment/
```

---

## License

MIT

---

Built by [Elenjical Solutions](https://github.com/Elenjical-Solutions) with [Claude](https://claude.ai).
