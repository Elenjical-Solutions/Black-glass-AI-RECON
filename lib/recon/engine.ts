import { ParsedFile } from "./parsers/types"
import { matchRows, KeyFieldPair } from "./row-matcher"
import { compareFields, FieldMapping, FieldComparisonResult } from "./field-comparator"
import { applyExplanationKeys, ExplanationKeyRule, AppliedExplanation } from "./explanation-applier"

export interface ReconConfig {
  keyFields: KeyFieldPair[]
  fieldMappings: FieldMapping[]
  explanationKeys?: ExplanationKeyRule[] // Optional: if provided AND autoApply=true, runs deterministic pattern matching
  autoApplyKeys?: boolean // Default false — keys are not auto-applied unless explicitly requested
}

export interface ReconResultRow {
  keyValue: string
  sourceARowIndex: number | null
  sourceBRowIndex: number | null
  status: "match" | "break" | "missing_a" | "missing_b"
  fields: FieldComparisonResult[]
  explanationKeyId?: string
  explanationKeyCode?: string
  explanationReason?: string
}

export interface ReconOutput {
  results: ReconResultRow[]
  summary: {
    totalRows: number
    matched: number
    breaks: number
    missingA: number
    missingB: number
    explained: number
    unexplained: number
  }
}

export function runReconciliation(
  fileA: ParsedFile,
  fileB: ParsedFile,
  config: ReconConfig
): ReconOutput {
  // Step 1: Match rows by key fields
  const { matchedPairs, unmatchedA, unmatchedB } = matchRows(
    fileA.rows,
    fileB.rows,
    config.keyFields
  )

  const results: ReconResultRow[] = []

  // Step 2: Compare fields for matched pairs
  for (const { rowA, rowB, keyValue } of matchedPairs) {
    const fieldResults = compareFields(rowA.data, rowB.data, config.fieldMappings)
    const allMatch = fieldResults.every((f) => f.isMatch)

    results.push({
      keyValue,
      sourceARowIndex: rowA.index,
      sourceBRowIndex: rowB.index,
      status: allMatch ? "match" : "break",
      fields: fieldResults,
    })
  }

  // Step 3: Build results for unmatched rows
  for (const row of unmatchedA) {
    const keyFields = config.keyFields.map((kf) => kf.fieldA)
    const keyValue = keyFields.map((f) => row.data[f] ?? "").join("|")

    results.push({
      keyValue,
      sourceARowIndex: row.index,
      sourceBRowIndex: null,
      status: "missing_b",
      fields: [],
    })
  }

  for (const row of unmatchedB) {
    const keyFields = config.keyFields.map((kf) => kf.fieldB)
    const keyValue = keyFields.map((f) => row.data[f] ?? "").join("|")

    results.push({
      keyValue,
      sourceARowIndex: null,
      sourceBRowIndex: row.index,
      status: "missing_a",
      fields: [],
    })
  }

  // Step 4: Optionally apply explanation keys (only if autoApplyKeys is true)
  if (config.autoApplyKeys && config.explanationKeys && config.explanationKeys.length > 0) {
    const breakResults = results
      .filter((r) => r.status === "break")
      .map((r, _i) => ({
        index: results.indexOf(r),
        status: r.status,
        fields: r.fields.map((f) => ({
          fieldNameA: f.fieldNameA,
          valueA: f.valueA,
          valueB: f.valueB,
          numericDiff: f.matcherResult.numericDiff,
          isMatch: f.isMatch,
        })),
      }))

    const appliedExplanations: AppliedExplanation[] = applyExplanationKeys(
      breakResults,
      config.explanationKeys
    )

    for (const explanation of appliedExplanations) {
      const result = results[explanation.resultIndex]
      if (result) {
        result.explanationKeyId = explanation.explanationKeyId
        result.explanationKeyCode = explanation.explanationKeyCode
        result.explanationReason = explanation.reason
      }
    }
  }

  // Step 5: Calculate summary
  const matched = results.filter((r) => r.status === "match").length
  const breaks = results.filter((r) => r.status === "break").length
  const missingA = results.filter((r) => r.status === "missing_a").length
  const missingB = results.filter((r) => r.status === "missing_b").length
  const explained = results.filter((r) => r.status === "break" && r.explanationKeyId).length
  const unexplained = breaks - explained

  return {
    results,
    summary: {
      totalRows: results.length,
      matched,
      breaks,
      missingA,
      missingB,
      explained,
      unexplained,
    },
  }
}
