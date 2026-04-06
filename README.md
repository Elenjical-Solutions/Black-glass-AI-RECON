# Black Glass AI RECON

**Smart Dependency Reconciliation Tool** by [Elenjical Solutions](https://github.com/Elenjical-Solutions)

A modern, AI-powered reconciliation platform for financial markets. Compare files from system upgrades/migrations with intelligent dependency tracking, auto-explanation of differences, and visual dependency tree propagation.

## Key Features

### Core Reconciliation
- **File Comparison**: Upload and compare CSV and XML files side by side
- **Field Mapping**: Map fields between files with different column names (AI-suggested mappings)
- **Flexible Matching**: Text, number (with tolerances), date, and regex matchers
- **Tolerance Types**: Absolute, percentage, and basis points for numeric comparisons

### AI-Powered Intelligence
- **Auto-Explain Differences**: Claude analyzes breaks and provides financial-domain explanations
- **Smart Field Mapping**: AI suggests field mappings based on header names and sample data
- **Auto-Categorization**: Automatically classify breaks (rounding, FX conversion, timing, methodology, etc.)
- **Screenshot Comparison**: Compare system screenshots using Claude's vision capabilities
- **Executive Summaries**: AI-generated summaries of reconciliation status

### Dependency Tree Reconciliation
- **Visual DAG**: Interactive dependency graph between reconciliation definitions
- **Auto-Propagation**: When a core reconciliation break is explained, downstream reports auto-inherit the explanation
- **Topological Processing**: Efficient Kahn's algorithm-based propagation through the dependency tree

### Regression Cycle Management
- **Multiple Cycles**: Run reconciliation across multiple regression cycles
- **Cross-Cycle Comparison**: Compare results between cycles to track improvements/regressions
- **Result Persistence**: Save and reload all reconciliation results

### Explanation Keys
- **Reusable Tags**: Define explanation keys for known differences (e.g., FX_ROUNDING, TIMING_DIFF)
- **Auto-Apply Rules**: Pattern-based rules to auto-tag recurring differences
- **Color-Coded**: Visual identification with custom colors

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | Shadcn/UI + Tailwind CSS 4 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |
| AI | Claude API (@anthropic-ai/sdk) |
| Graph Viz | React Flow (@xyflow/react) |
| Tables | @tanstack/react-table |
| Charts | Recharts |
| File Parsing | papaparse (CSV) + fast-xml-parser (XML) |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Anthropic API key (for AI features)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Elenjical-Solutions/Black-glass-AI-RECON.git
cd Black-glass-AI-RECON
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL, Clerk keys, and Anthropic API key
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
black-glass-ai-recon/
├── app/                          # Next.js App Router pages
│   ├── dashboard/                # Main application
│   │   ├── projects/             # Project management
│   │   │   └── [projectId]/      # Project detail
│   │   │       ├── files/        # File upload & management
│   │   │       ├── definitions/  # Reconciliation definitions
│   │   │       ├── dependencies/ # Dependency graph (React Flow)
│   │   │       ├── explanation-keys/ # Explanation key management
│   │   │       ├── cycles/       # Regression cycles
│   │   │       │   └── [cycleId]/
│   │   │       │       ├── runs/ # Run results
│   │   │       │       └── compare/ # Cross-cycle comparison
│   │   │       └── screenshots/  # Screenshot comparison
├── actions/                      # Server actions (mutations)
├── components/
│   ├── ui/                       # Shadcn/UI components
│   ├── recon/                    # Reconciliation components
│   └── dependency/               # Dependency graph components
├── db/
│   ├── schema/                   # Drizzle ORM schemas (12 tables)
│   └── migrations/               # Database migrations
├── lib/
│   ├── recon/                    # Core reconciliation engine
│   │   ├── matchers/             # Pluggable matcher system
│   │   ├── parsers/              # CSV/XML file parsers
│   │   ├── engine.ts             # Main orchestrator
│   │   ├── row-matcher.ts        # Key-based row matching
│   │   ├── field-comparator.ts   # Field-level comparison
│   │   ├── explanation-applier.ts # Auto-apply explanation keys
│   │   └── dependency-propagator.ts # DAG propagation
│   └── ai/                       # Claude AI integration
│       ├── client.ts             # Anthropic SDK client
│       ├── field-mapping-suggest.ts
│       ├── diff-explainer.ts
│       ├── auto-categorizer.ts
│       ├── screenshot-analyzer.ts
│       └── summary-generator.ts
└── types/                        # TypeScript type definitions
```

## Reconciliation Workflow

1. **Create Project** - Set up a new reconciliation project
2. **Upload Files** - Upload CSV/XML files as Source A (old system) and Source B (new system)
3. **Define Reconciliation** - Create definitions mapping which files to compare
4. **Map Fields** - Map columns between files (use AI suggestions for speed)
5. **Set Up Explanation Keys** - Define known difference categories
6. **Configure Dependencies** - Build the dependency tree between definitions
7. **Run Cycle** - Execute reconciliation across all definitions
8. **Review Results** - Examine breaks, assign explanation keys, request AI analysis
9. **Propagate** - Auto-attribute downstream breaks from explained core differences
10. **Compare Cycles** - Track progress across regression cycles

## License

MIT
