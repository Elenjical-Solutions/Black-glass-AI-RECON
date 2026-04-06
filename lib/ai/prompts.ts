export function fieldMappingSuggestPrompt(
  headersA: string[],
  headersB: string[],
  sampleRowsA?: Record<string, string>[],
  sampleRowsB?: Record<string, string>[]
): { system: string; userMessage: string } {
  const system =
    "You are a financial data reconciliation expert. Given column headers from two data sources, suggest the best field-to-field mapping. Consider common financial terminology (MtM = Mark to Market = market_value, PnL = P&L = profit_and_loss, Notional = notional_amount, Delta = delta_sensitivity, FX = fx_rate, CCY = currency, ISIN/CUSIP/SEDOL = security identifiers). Return valid JSON only."

  let userMessage = `File A headers: ${JSON.stringify(headersA)}\nFile B headers: ${JSON.stringify(headersB)}`

  if (sampleRowsA && sampleRowsA.length > 0) {
    userMessage += `\n\nSample rows from A: ${JSON.stringify(sampleRowsA.slice(0, 3), null, 2)}`
  }
  if (sampleRowsB && sampleRowsB.length > 0) {
    userMessage += `\n\nSample rows from B: ${JSON.stringify(sampleRowsB.slice(0, 3), null, 2)}`
  }

  userMessage += `\n\nReturn JSON: { "mappings": [{ "fieldA": string, "fieldB": string, "confidence": number, "matcherType": "text"|"number"|"date", "suggestedTolerance"?: number }] }`

  return { system, userMessage }
}

export function diffExplainerPrompt(
  breaks: Array<{
    rowKey: string
    fieldName: string
    valueA: string
    valueB: string
    numericDiff?: number
  }>
): { system: string; userMessage: string } {
  const system =
    "You are analyzing reconciliation breaks in financial data from a system migration/upgrade. For each break, provide a concise explanation. Common causes: rounding differences, FX conversion rate differences, T vs T+1 timing, different calculation methodologies (e.g., linear vs log returns), missing trades, corporate actions, daycount convention differences, curve stripping methodology. Be specific and quantitative where possible."

  const formattedBreaks = breaks.map((b) => ({
    rowKey: b.rowKey,
    fieldName: b.fieldName,
    valueA: b.valueA,
    valueB: b.valueB,
    ...(b.numericDiff !== undefined ? { numericDiff: b.numericDiff } : {}),
  }))

  const userMessage = `Here are the reconciliation breaks to analyze:\n\n${JSON.stringify(formattedBreaks, null, 2)}\n\nFor each break, return a JSON array: [{ "rowKey": string, "fieldName": string, "explanation": string, "category": string, "confidence": number }]`

  return { system, userMessage }
}

export function autoCategorizePrompt(
  breaks: Array<{
    rowKey: string
    fieldName: string
    valueA: string
    valueB: string
    diff?: number
  }>
): { system: string; userMessage: string } {
  const system =
    "Categorize these financial reconciliation differences. Categories: ROUNDING (small numeric differences due to precision), FX_CONVERSION (currency/FX rate differences), TIMING (date/settlement timing), METHODOLOGY (different calc approaches), MISSING_DATA (null/empty in one source), DATA_ENTRY (formatting/typo differences), SYSTEM_BUG (clearly incorrect values), TRADE_POPULATION (different trade universe), CURVE_STRIPPING (yield curve differences), CORPORATE_ACTION (stock splits, dividends), OTHER."

  const formattedBreaks = breaks.map((b) => ({
    rowKey: b.rowKey,
    fieldName: b.fieldName,
    valueA: b.valueA,
    valueB: b.valueB,
    ...(b.diff !== undefined ? { diff: b.diff } : {}),
  }))

  const userMessage = `Categorize each of these breaks:\n\n${JSON.stringify(formattedBreaks, null, 2)}\n\nReturn JSON: [{ "rowKey": string, "fieldName": string, "category": string, "confidence": number }]`

  return { system, userMessage }
}

export function screenshotComparePrompt(): {
  system: string
  userMessage: string
} {
  const system =
    "Compare these two screenshots from financial trading/risk systems. Identify ALL visible differences in numbers, text, formatting, or layout. For each difference, describe: location on screen, value in System A, value in System B, likely cause. Focus on material numerical differences that could indicate reconciliation issues."

  const userMessage =
    "Please compare these two system screenshots and identify all differences."

  return { system, userMessage }
}

export function summaryGeneratorPrompt(stats: {
  totalRows: number
  matched: number
  breaks: number
  explained: number
  unexplained: number
  topCategories: Array<{ category: string; count: number }>
  topExplanationKeys: Array<{ code: string; count: number }>
}): { system: string; userMessage: string } {
  const system =
    "Generate an executive summary of a financial reconciliation run. Be concise, highlight risks, and suggest next steps. Write for a senior risk manager audience."

  const userMessage = `Reconciliation Run Statistics:
- Total Rows: ${stats.totalRows}
- Matched: ${stats.matched} (${((stats.matched / stats.totalRows) * 100).toFixed(1)}%)
- Breaks: ${stats.breaks} (${((stats.breaks / stats.totalRows) * 100).toFixed(1)}%)
- Explained Breaks: ${stats.explained}
- Unexplained Breaks: ${stats.unexplained}

Top Break Categories:
${stats.topCategories.map((c) => `  - ${c.category}: ${c.count}`).join("\n")}

Top Explanation Codes:
${stats.topExplanationKeys.map((e) => `  - ${e.code}: ${e.count}`).join("\n")}

Please provide a 2-3 paragraph executive summary suitable for a senior risk manager.`

  return { system, userMessage }
}
