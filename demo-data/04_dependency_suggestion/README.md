# Demo 4: Intelligent Dependency Suggestion

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
