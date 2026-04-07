# Black Glass AI RECON

**Smart Dependency Reconciliation Tool** by [Elenjical Solutions](https://github.com/Elenjical-Solutions)

An AI-powered reconciliation platform for financial markets. Built for system upgrade scenarios (e.g., Murex MX.3 version upgrades), it compares before/after data across core trades, sensitivities, and downstream reports — with intelligent dependency tracking that propagates explanations through the entire reporting chain.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Step-by-Step Walkthrough](#step-by-step-walkthrough)
  - [1. Create a Project](#1-create-a-project)
  - [2. Upload Files](#2-upload-files)
  - [3. Create a Recon Template (Definition)](#3-create-a-recon-template-definition)
  - [4. Set Up Explanation Keys](#4-set-up-explanation-keys)
  - [5. Configure Dependencies](#5-configure-dependencies)
  - [6. Run a Reconciliation Cycle](#6-run-a-reconciliation-cycle)
  - [7. Review Results](#7-review-results)
  - [8. AI Features](#8-ai-features)
- [Pre-Configured Explanation Keys](#pre-configured-explanation-keys)
- [Demo Data for Testing](#demo-data-for-testing)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)

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

# 4. (Optional) Seed with 10K Murex demo trades
npm run seed

# 5. (Optional) Generate small test files for manual testing
npx tsx scripts/generate-test-files.ts
npx tsx scripts/generate-demo-data.ts

# 6. Start the app
npm run dev
# Open http://localhost:3000
```

---

## Core Concepts

| Concept | What It Is | Example |
|---------|-----------|---------|
| **Project** | A container for an entire reconciliation exercise | "Murex MX 3.1.58 to 3.1.62 Upgrade" |
| **File** | A CSV or XML data extract uploaded to the project | `core_recon_MX3158.csv` (Source A) |
| **Definition (Recon Template)** | A reusable configuration: field mappings, match rules, tolerances, key fields | "Core Trade Reconciliation" with 15 mapped fields |
| **Explanation Key** | A tag for a known reason why values differ | `BOOTSTRAP_METHOD` — "IR curve bootstrap changed" |
| **Dependency Edge** | A link from an upstream recon to a downstream report | Core Recon → Daily P&L Report |
| **Cycle** | A regression test run — executes definitions against file pairs | "Cycle 1 — Initial Comparison" |
| **Run** | One execution of a definition against two files within a cycle | Core Trade Recon: 8,001 matched, 1,984 breaks |

**Key insight:** Definitions are *templates*, not tied to specific files. You define the field mappings and match rules once, then run the same template against different file pairs in each regression cycle.

---

## Step-by-Step Walkthrough

### 1. Create a Project

1. Sign in at `http://localhost:3000`
2. Go to **Dashboard** → **Projects** → **New Project**
3. Enter a name (e.g., "MX 3.1.58 → 3.1.62 Upgrade") and optional description
4. Click **Create**

You'll land on the project overview with tabs: Overview, Files, Folders, Definitions, Dependencies, Explanation Keys, Cycles, Screenshots.

### 2. Upload Files

Go to the **Files** tab.

1. Select the file role: **Source A** (old system / before) or **Source B** (new system / after)
2. Drag and drop a CSV/XML file into the upload zone, or click to browse
3. The file is parsed immediately — headers detected, row count shown
4. Repeat for as many files as needed

**Supported formats:** `.csv`, `.xml`, `.tsv`

**File roles:**
- **Source A** = the "before" / old system / baseline
- **Source B** = the "after" / new system / upgraded

> **Tip:** You can also use the **Folders** tab to point to two directories on your machine. The system auto-discovers files, matches them by name, and bulk-imports them.

### 3. Create a Recon Template (Definition)

Go to the **Definitions** tab → **New Recon Template**.

This is a 3-step wizard:

#### Step 1: Select Files

Choose your mode:
- **Upload New Files** — pick CSV files directly from your machine. Headers are parsed instantly in-browser (no server round-trip needed).
- **Use Existing Files** — select from files already uploaded to the project.

Two buttons appear:
- **AI Suggest Mappings** — Claude analyzes both files' column names and suggests mappings using financial domain knowledge. Works even when column names are completely different (e.g., `MtM_Value` → `mark_to_market`).
- **Auto-Detect Columns & Map** — simple name-matching algorithm. Fast, works when column names are identical or very similar.

#### Step 2: Map Fields

A table appears with all detected field mappings:

| Column | Purpose |
|--------|---------|
| **Key** (checkbox) | Mark this field as a row-matching key (e.g., `trade_id`, `portfolio`) |
| **Source A Field** | Column name from file A |
| **Source B Field** | Column name from file B |
| **Match Type** | `Text` (exact/case-insensitive), `Number` (with tolerance), `Date`, or `Regex` |
| **Tolerance** | For number fields: the acceptable difference (e.g., `0.01`) |
| **Tolerance Type** | `Absolute` ($0.01), `Percentage` (1%), or `Basis Points` (100bp) |

You can add, remove, or edit any mapping. Key fields are used to match rows between the two files — typically `trade_id` + `portfolio`.

#### Step 3: Name & Save

- **Template Name** — e.g., "Core Trade Reconciliation"
- **Description** — what this template reconciles
- **Category** — `Core Reconciliation`, `Sensitivity`, or `Downstream Report`
- **Department / Asset Class** — e.g., "IR", "FX", "Market Risk", "Finance"

Click **Create Template**. Files are uploaded, the definition is saved, and all field mappings are persisted.

### 4. Set Up Explanation Keys

Go to the **Explanation Keys** tab → **New Key**.

Explanation keys are reusable labels that describe *why* a reconciliation break occurred. When you investigate a break and determine the root cause, you assign a key.

**Fields when creating a key:**

| Field | Required | Example |
|-------|----------|---------|
| **Code** | Yes | `BOOTSTRAP_METHOD` |
| **Label** | Yes | "IR Curve Bootstrap Methodology Change" |
| **Description** | No | "MX 3.1.62 uses improved piecewise cubic Hermite interpolation..." |
| **Color** | No | Pick from presets or enter hex (e.g., `#3b82f6`) |
| **Auto-Match Pattern** | No | Rules to auto-apply this key (see below) |

**Auto-Match Pattern** (optional, for automatic assignment):
- **Field Name** — which column to check (e.g., `market_value`)
- **Diff Range Min / Max** — numeric difference bounds (e.g., `-500` to `500`)
- **Value A Pattern** — regex to match Source A values
- **Value B Pattern** — regex to match Source B values

When a reconciliation runs, any break matching an auto-match pattern gets this key assigned automatically.

### 5. Configure Dependencies

Go to the **Dependencies** tab.

This is the three-panel command center:

**Left panel — Tree Browser:**
- Definitions grouped by category: Core → Sensitivity → Downstream (by department)
- Each item shows a status dot (green = no breaks, red = has breaks) and break count
- Click to select a definition

**Center panel — Lineage Visualizer:**
- Shows the selected definition's upstream and downstream connections
- Click nodes to navigate the dependency tree

**Right panel — Summary:**
- Stats for the selected definition
- Explanation key breakdown
- **AI Suggest Dependencies** button (for downstream definitions)

**To add a dependency manually:**
1. Click **Add Dependency** in the toolbar
2. Select the **Parent** (upstream, e.g., "Core Trade Recon")
3. Select the **Child** (downstream, e.g., "Daily P&L Report")
4. Configure field mappings: which fields connect them (e.g., `trade_id → trade_id`)
5. Click **Add Edge**

**What dependencies do:** After you explain breaks in a core/sensitivity recon, click **Propagate All** to auto-attribute matching downstream breaks. If an FX delta difference is explained in your FX Sensitivity recon, the same explanation flows to all downstream reports that show the same FX delta difference.

### 6. Run a Reconciliation Cycle

Go to the **Cycles** tab → **New Cycle**.

1. Give it a name (e.g., "Cycle 1 — Initial Comparison")
2. Click **Create**
3. Open the cycle

You have two options:

**Option A: Run All (Default Files)**
- Runs every definition using its saved default file pair
- Good for batch execution after initial setup

**Option B: Run with Files**
- Opens a dialog where you select:
  - **Recon Template** — which definition to use
  - **Source A File** — the old/before file
  - **Source B File** — the new/after file
- Click **Run Reconciliation**
- This is the key feature: same template, different files each cycle

Runs are grouped by category: **Core** → **Sensitivity** → **Downstream**. Each shows:
- Definition name and department
- Files compared (file A → file B)
- Status (pending/processing/completed/failed)
- Match / Break / Explained counts with a progress bar

### 7. Review Results

Click the arrow icon on a completed run to open the results page.

**What you see:**

**Header:** Definition name, category badge, department, source file names with row counts.

**Summary cards:** Total Rows, Matched (green), Breaks (red), Explained (amber), Unexplained (orange).

**Filter bar:**
- Search by row key (e.g., `MX00150`)
- Filter by status: All, Match, Break, Missing A, Missing B
- Filter by explanation key
- **AI Break Analysis** button (see AI Features below)
- **AI Insights** panel (explain selected, generate summary)

**Results table:**
- Each row: checkbox, expand arrow, row key, status badge, explanation key
- Click a row to expand and see all field-level comparisons (Value A, Value B, Diff, Match/No Match)
- For break rows without a key: sparkles icon for **AI Key Suggestion**

**Bulk actions:** Select multiple rows → choose an explanation key → click **Assign Key** to tag them all at once.

### 8. AI Features

Four AI capabilities powered by Claude:

#### AI Break Pattern Analyst
**Where:** Results page → **AI Break Analysis** button

Analyzes ALL breaks holistically to identify clusters and patterns. Instead of reviewing 2,000 breaks one by one, get a summary like:
> "399 breaks (20%) are IR products where DV01 shifted 2-5% — consistent with bootstrap methodology change. 339 breaks are options where vega shifted 8-15% — vol surface interpolation change. 5 anomalies with >$500K diffs don't correlate with any sensitivity shift."

Click **Apply All Suggestions** to batch-assign explanation keys to each cluster.

#### AI Field Mapping
**Where:** Definition wizard → Step 1 → **AI Suggest Mappings** button

When column names differ between systems (e.g., `MtM_Value` vs `mark_to_market`), AI maps them using financial domain knowledge. Handles common abbreviations: MtM = Mark to Market, Cpty = Counterparty, DV01 = Dollar Value of 01, etc.

#### Smart Explanation Key Suggestion
**Where:** Results table → sparkles icon on each break row

Click the sparkles icon on any unassigned break. AI examines the specific field differences, product type, and asset class, then suggests the best explanation key with a confidence percentage and reasoning.

#### Intelligent Dependency Suggestion
**Where:** Dependencies tab → select a downstream definition → **AI Suggest Dependencies**

AI analyzes the downstream report's columns and identifies which core/sensitivity recons it likely depends on. Shows shared columns and confidence per suggestion. Click **Accept** to create the edge.

---

## Pre-Configured Explanation Keys

The seed data includes 14 explanation keys representing realistic causes of differences during a Murex system upgrade:

| Code | Label | Typical Impact | Asset Classes |
|------|-------|---------------|---------------|
| `BOOTSTRAP_METHOD` | IR Curve Bootstrap Methodology Change | DV01 shifts 2-5%, MV proportional | IR |
| `VOL_SURFACE_INTERP` | Volatility Surface Interpolation Change | Vega shifts 8-15%, option MV follows | FX, EQ, COM |
| `DAYCOUNT_CONV` | Day Count Convention Correction | Small PnL/cash diffs on GBP products | IR |
| `FX_RATE_SOURCE` | FX Fixing Source Change | FX delta and cross-currency basis diffs | FX |
| `SETTLEMENT_DATE` | Settlement Date Handling Fix | Cash timing between past/future buckets | IR, FX |
| `ROUNDING_PRECISION` | Rounding Precision Increase | Sub-cent diffs (<$0.05) everywhere | All |
| `BARRIER_ENGINE` | Barrier Option Pricing Engine Upgrade | Large MV and Greek diffs on barriers | FX, EQ |
| `CURVE_STRIPPING` | OIS Discounting Curve Stripping | DV01 and MV on IR products | IR |
| `THETA_CALC` | Theta Calculation Method Change | Theta diffs on options (sticky delta vs strike) | FX, EQ, COM |
| `QUANTO_CORR` | Quanto Correlation Surface Update | MV and delta on quanto products | FX |
| `REPO_ACCRUAL` | Repo Accrual Methodology Change | Past cash and settled cash on repos | IR |
| `COMMODITY_CURVE` | Commodity Forward Curve Construction | Commodity delta and forward prices | COM |
| `XVA_MODEL` | XVA Model Recalibration | XVA P&L components | All |
| `TRADE_POPULATION` | Trade Population Difference | Trades in source but not target (or vice versa) | All |

### How to Define New Explanation Keys

1. Go to your project → **Explanation Keys** tab
2. Click **New Key**
3. Fill in:
   - **Code**: Short uppercase identifier (e.g., `NEW_FEE_CALC`)
   - **Label**: Human-readable name (e.g., "Fee Calculation Methodology Change")
   - **Description**: Explain when this key applies and why the difference occurs
   - **Color**: Pick a color for visual identification in the results table
4. Optionally set an **Auto-Match Pattern**:
   - If you know the difference always appears in the `fee_amount` field with a diff between -10 and 10:
     - Field Name: `fee_amount`
     - Diff Range Min: `-10`
     - Diff Range Max: `10`
   - This causes the key to auto-assign during reconciliation runs
5. Click **Create**

The key is now available for:
- Manual assignment on the results page (dropdown per row or bulk assign)
- Auto-assignment during reconciliation (if auto-match pattern is set)
- AI suggestions (the AI considers all available keys when making recommendations)

---

## Demo Data for Testing

### Pre-Seeded Database (`npm run seed`)
- 10,000 trades across 25 typologies (IRS, FX Options, Equity, Commodities, etc.)
- 80% match rate, 20% breaks with realistic patterns
- 30 reconciliation definitions (1 core + 4 sensitivity + 25 downstream)
- 14 explanation keys
- Dependency tree connecting everything
- 1 regression cycle with core recon executed

### Small Test Files (`npx tsx scripts/generate-test-files.ts`)
Files in `test-data/` — 50-200 rows each, openable in Excel:

| File Pair | Rows | Purpose |
|-----------|------|---------|
| `core_source/target_MX3158/62.csv` | 200 | Core trade recon with ~40 breaks |
| `ir_sensi_source/target.csv` | 100 | IR sensitivity (DV01/Vega) |
| `eq_sensi_source/target.csv` | 50 | Equity sensitivity (Delta/Vega/Theta) |
| `fx_sensi_source/target.csv` | 60 | FX sensitivity with Greeks |
| `daily_pnl_source/target.csv` | 150 | Downstream P&L report |
| `var_report_source/target.csv` | 100 | Downstream VaR report |
| `frtb_sa_source/target.csv` | 80 | Regulatory FRTB SA report |

### AI Feature Demo Data (`npx tsx scripts/generate-demo-data.ts`)
Four folders in `demo-data/`, each designed to showcase a specific AI capability:

| Folder | What It Demonstrates |
|--------|---------------------|
| `01_break_pattern_analyst/` | 500 trades with 4 clustered break patterns + 5 anomalies. AI should identify all clusters. |
| `02_ai_field_mapping/` | Two files with completely different column names (Murex vs risk system). AI maps them. |
| `03_smart_key_suggestion/` | 50 trades where each break has a unique fingerprint. AI suggests the right key per row. |
| `04_dependency_suggestion/` | 5 downstream reports. AI analyzes columns to suggest upstream dependencies. |

Each folder has a `README.md` with step-by-step demo instructions.

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
| File Parsing | papaparse (CSV) + fast-xml-parser (XML) |

---

## Environment Variables

Create `.env.local` with:

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
AI_CACHE_TTL_HOURS=24        # Cache AI responses (default 24h)
RECON_CHUNK_SIZE=5000         # Rows per processing chunk (default 5000)
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run seed` | Seed database with 10K Murex demo trades |
| `npm run db:push` | Push Drizzle schema to PostgreSQL |
| `npm run db:generate` | Generate Drizzle migrations |
| `npx tsx scripts/generate-test-files.ts` | Generate small test CSVs in `test-data/` |
| `npx tsx scripts/generate-demo-data.ts` | Generate AI demo data in `demo-data/` |

---

## Project Structure

```
black-glass-ai-recon/
├── app/                          # Next.js App Router pages
│   ├── dashboard/                # Authenticated application
│   │   ├── projects/             # Project management
│   │   │   └── [projectId]/      # Project detail (8 tabs)
│   │   │       ├── files/        # File upload & preview
│   │   │       ├── folders/      # Folder scanner & auto-import
│   │   │       ├── definitions/  # Recon template CRUD + 3-step wizard
│   │   │       ├── dependencies/ # 3-panel command center
│   │   │       ├── explanation-keys/ # Key management
│   │   │       ├── cycles/       # Regression cycles
│   │   │       │   └── [cycleId]/
│   │   │       │       ├── runs/ # Results with AI features
│   │   │       │       └── compare/ # Cross-cycle comparison
│   │   │       └── screenshots/  # Visual comparison
│   │   └── settings/             # Clerk account management
│   ├── sign-in/                  # Clerk sign-in
│   └── sign-up/                  # Clerk sign-up
├── actions/                      # Server actions
│   ├── ai-actions.ts             # All AI features (4 analyzers)
│   ├── runs-actions.ts           # Run execution with file selection
│   ├── dependency-actions.ts     # Graph + propagation + lineage
│   └── ...                       # CRUD for all entities
├── components/
│   ├── ai/                       # AI feature components
│   │   ├── break-analysis-panel.tsx
│   │   ├── key-suggestion-inline.tsx
│   │   └── dependency-suggestion-panel.tsx
│   ├── dependency/               # 3-panel command center components
│   └── ui/                       # Shadcn/UI components
├── lib/
│   ├── recon/                    # Core reconciliation engine
│   │   ├── engine.ts             # Orchestrator
│   │   ├── matchers/             # Text/Number/Date/Regex matchers
│   │   ├── parsers/              # CSV/XML parsers
│   │   ├── dependency-propagator.ts # DAG traversal
│   │   └── folder-scanner.ts     # File discovery
│   ├── ai/                       # Claude API integration
│   │   ├── break-pattern-analyst.ts
│   │   ├── field-mapping-suggest.ts
│   │   ├── explanation-key-suggester.ts
│   │   └── dependency-suggester.ts
│   └── streaming/                # Chunked processing for large files
├── db/schema/                    # 12 Drizzle ORM table schemas
├── scripts/                      # Seed & demo data generators
├── test-data/                    # Small test CSVs (50-200 rows)
└── demo-data/                    # AI feature demo folders with READMEs
```

---

## License

MIT

---

Built by [Elenjical Solutions](https://github.com/Elenjical-Solutions) with [Claude](https://claude.ai).
