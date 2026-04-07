# Demo 1: AI Break Pattern Analyst

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
