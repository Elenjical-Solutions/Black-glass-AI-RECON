import { Matcher, MatcherConfig, MatcherResult } from "./types"

export class TextMatcher implements Matcher {
  type = "text"

  match(valueA: string | null, valueB: string | null, config: MatcherConfig): MatcherResult {
    const caseSensitive = config.caseSensitive ?? false
    const trimWhitespace = config.trimWhitespace ?? true

    // Both null -> match
    if (valueA === null && valueB === null) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { method: "exact" },
      }
    }

    // One null -> no match
    if (valueA === null || valueB === null) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { method: "exact" },
      }
    }

    let a = valueA
    let b = valueB

    if (trimWhitespace) {
      a = a.trim()
      b = b.trim()
    }

    // Exact match check first
    if (a === b) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { method: trimWhitespace && (valueA !== a || valueB !== b) ? "trimmed" : "exact" },
      }
    }

    // Case insensitive check
    if (!caseSensitive && a.toLowerCase() === b.toLowerCase()) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { method: "case_insensitive" },
      }
    }

    return {
      isMatch: false,
      valueA,
      valueB,
      details: {
        method: caseSensitive ? "exact" : "case_insensitive",
      },
    }
  }
}
