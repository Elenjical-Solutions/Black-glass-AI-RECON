# Demo 2: AI Field Mapping

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
