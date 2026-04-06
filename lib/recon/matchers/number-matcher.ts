import { Matcher, MatcherConfig, MatcherResult } from "./types"

/**
 * Parse a numeric string, handling commas, currency symbols, and parentheses for negatives.
 * Examples: "$1,234.56" -> 1234.56, "(500)" -> -500, "1,000" -> 1000
 */
function parseNumericValue(value: string): number {
  let cleaned = value.trim()

  // Handle parentheses for negative numbers: (500) -> -500
  const parenMatch = cleaned.match(/^\((.+)\)$/)
  if (parenMatch) {
    cleaned = "-" + parenMatch[1]
  }

  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[$€£¥₹\s]/g, "")

  // Remove commas used as thousand separators
  cleaned = cleaned.replace(/,/g, "")

  return parseFloat(cleaned)
}

export class NumberMatcher implements Matcher {
  type = "number"

  match(valueA: string | null, valueB: string | null, config: MatcherConfig): MatcherResult {
    // Both null -> match
    if (valueA === null && valueB === null) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { parsedA: null, parsedB: null, diff: 0, tolerance: null, toleranceType: null, method: "exact" },
      }
    }

    // One null -> no match
    if (valueA === null || valueB === null) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { parsedA: null, parsedB: null, diff: null, tolerance: null, toleranceType: null, method: "null_mismatch" },
      }
    }

    const parsedA = parseNumericValue(valueA)
    const parsedB = parseNumericValue(valueB)

    // If either is NaN, fall back to text comparison
    if (isNaN(parsedA) || isNaN(parsedB)) {
      const isMatch = valueA.trim() === valueB.trim()
      return {
        isMatch,
        valueA,
        valueB,
        details: {
          parsedA: isNaN(parsedA) ? null : parsedA,
          parsedB: isNaN(parsedB) ? null : parsedB,
          diff: null,
          tolerance: config.tolerance ?? null,
          toleranceType: config.toleranceType ?? null,
          method: "text_fallback",
        },
      }
    }

    const diff = parsedA - parsedB
    const absDiff = Math.abs(diff)
    const tolerance = config.tolerance
    const toleranceType = config.toleranceType ?? "absolute"

    let isMatch: boolean

    if (tolerance === undefined || tolerance === null) {
      // Exact match required
      isMatch = parsedA === parsedB
    } else {
      switch (toleranceType) {
        case "percentage": {
          // Avoid division by zero
          const pctDiff = parsedA === 0 ? (parsedB === 0 ? 0 : Infinity) : (absDiff / Math.abs(parsedA)) * 100
          isMatch = pctDiff <= tolerance
          break
        }
        case "basis_points": {
          const bpDiff = parsedA === 0 ? (parsedB === 0 ? 0 : Infinity) : (absDiff / Math.abs(parsedA)) * 10000
          isMatch = bpDiff <= tolerance
          break
        }
        case "absolute":
        default:
          isMatch = absDiff <= tolerance
          break
      }
    }

    return {
      isMatch,
      valueA,
      valueB,
      numericDiff: diff,
      details: {
        parsedA,
        parsedB,
        diff,
        tolerance: tolerance ?? null,
        toleranceType: tolerance !== undefined ? toleranceType : null,
        method: "numeric",
      },
    }
  }
}
