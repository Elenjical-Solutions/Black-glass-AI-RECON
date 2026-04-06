export interface MatcherResult {
  isMatch: boolean
  valueA: string | null
  valueB: string | null
  numericDiff?: number
  details: Record<string, unknown>
}

export interface MatcherConfig {
  tolerance?: number
  toleranceType?: "absolute" | "percentage" | "basis_points"
  caseSensitive?: boolean
  trimWhitespace?: boolean
  dateFormat?: string
  regexPattern?: string
}

export interface Matcher {
  type: string
  match(valueA: string | null, valueB: string | null, config: MatcherConfig): MatcherResult
}
