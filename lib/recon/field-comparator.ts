import { MatcherResult, MatcherConfig } from "./matchers/types"
import { getMatcher } from "./matchers"

export interface FieldMapping {
  fieldNameA: string
  fieldNameB: string
  matcherType: string
  tolerance?: number
  toleranceType?: string
}

export interface FieldComparisonResult {
  fieldNameA: string
  fieldNameB: string
  valueA: string | null
  valueB: string | null
  isMatch: boolean
  matcherResult: MatcherResult
}

export function compareFields(
  rowA: Record<string, string>,
  rowB: Record<string, string>,
  fieldMappings: FieldMapping[]
): FieldComparisonResult[] {
  return fieldMappings.map((mapping) => {
    const valueA = rowA[mapping.fieldNameA] ?? null
    const valueB = rowB[mapping.fieldNameB] ?? null

    const config: MatcherConfig = {}
    if (mapping.tolerance !== undefined) {
      config.tolerance = mapping.tolerance
    }
    if (mapping.toleranceType) {
      config.toleranceType = mapping.toleranceType as MatcherConfig["toleranceType"]
    }

    const matcher = getMatcher(mapping.matcherType)
    const matcherResult = matcher.match(valueA, valueB, config)

    return {
      fieldNameA: mapping.fieldNameA,
      fieldNameB: mapping.fieldNameB,
      valueA,
      valueB,
      isMatch: matcherResult.isMatch,
      matcherResult,
    }
  })
}
