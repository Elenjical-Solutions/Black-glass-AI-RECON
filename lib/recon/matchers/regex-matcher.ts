import { Matcher, MatcherConfig, MatcherResult } from "./types"

export class RegexMatcher implements Matcher {
  type = "regex"

  match(valueA: string | null, valueB: string | null, config: MatcherConfig): MatcherResult {
    const pattern = config.regexPattern

    if (!pattern) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { pattern: null, matchA: null, matchB: null, error: "No regex pattern specified" },
      }
    }

    // Both null -> match (both fail to match any pattern equally)
    if (valueA === null && valueB === null) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { pattern, matchA: false, matchB: false },
      }
    }

    // One null -> no match
    if (valueA === null || valueB === null) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { pattern, matchA: valueA !== null, matchB: valueB !== null },
      }
    }

    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { pattern, matchA: null, matchB: null, error: "Invalid regex pattern" },
      }
    }

    const resultA = regex.exec(valueA)
    const resultB = regex.exec(valueB)

    const matchA = resultA !== null
    const matchB = resultB !== null

    // Both must match or both must not match
    if (matchA !== matchB) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { pattern, matchA, matchB },
      }
    }

    // If both don't match the pattern, they are considered equal in that regard
    if (!matchA && !matchB) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { pattern, matchA, matchB },
      }
    }

    // Both match: check if captured groups are equal
    const groupsA = resultA!.slice(1)
    const groupsB = resultB!.slice(1)

    const groupsEqual =
      groupsA.length === groupsB.length &&
      groupsA.every((g, i) => g === groupsB[i])

    return {
      isMatch: groupsEqual,
      valueA,
      valueB,
      details: {
        pattern,
        matchA,
        matchB,
        groupsA,
        groupsB,
        groupsEqual,
      },
    }
  }
}
