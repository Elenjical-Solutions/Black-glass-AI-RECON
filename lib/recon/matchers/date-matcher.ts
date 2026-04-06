import { Matcher, MatcherConfig, MatcherResult } from "./types"

const MS_PER_DAY = 86400000

/**
 * Parse a date string. If dateFormat is provided, attempt basic format parsing.
 * Otherwise, fall back to the Date constructor.
 */
function parseDate(value: string, dateFormat?: string): Date | null {
  const trimmed = value.trim()

  if (dateFormat) {
    // Basic format parsing for common patterns
    const date = parseDateWithFormat(trimmed, dateFormat)
    if (date && !isNaN(date.getTime())) {
      return date
    }
  }

  // Fallback to native Date constructor
  const date = new Date(trimmed)
  if (!isNaN(date.getTime())) {
    return date
  }

  return null
}

function parseDateWithFormat(value: string, format: string): Date | null {
  // Support common format tokens: YYYY, MM, DD, HH, mm, ss
  const tokenRegex: Record<string, string> = {
    YYYY: "(?<year>\\d{4})",
    MM: "(?<month>\\d{2})",
    DD: "(?<day>\\d{2})",
    HH: "(?<hour>\\d{2})",
    mm: "(?<minute>\\d{2})",
    ss: "(?<second>\\d{2})",
  }

  let pattern = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  for (const [token, regex] of Object.entries(tokenRegex)) {
    pattern = pattern.replace(token, regex)
  }

  const match = value.match(new RegExp(`^${pattern}$`))
  if (!match || !match.groups) return null

  const year = parseInt(match.groups.year ?? "1970", 10)
  const month = parseInt(match.groups.month ?? "1", 10) - 1
  const day = parseInt(match.groups.day ?? "1", 10)
  const hour = parseInt(match.groups.hour ?? "0", 10)
  const minute = parseInt(match.groups.minute ?? "0", 10)
  const second = parseInt(match.groups.second ?? "0", 10)

  return new Date(year, month, day, hour, minute, second)
}

export class DateMatcher implements Matcher {
  type = "date"

  match(valueA: string | null, valueB: string | null, config: MatcherConfig): MatcherResult {
    // Both null -> match
    if (valueA === null && valueB === null) {
      return {
        isMatch: true,
        valueA,
        valueB,
        details: { parsedA: null, parsedB: null, diffDays: 0 },
      }
    }

    // One null -> no match
    if (valueA === null || valueB === null) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: { parsedA: null, parsedB: null, diffDays: null },
      }
    }

    const dateA = parseDate(valueA, config.dateFormat)
    const dateB = parseDate(valueB, config.dateFormat)

    if (!dateA || !dateB) {
      return {
        isMatch: false,
        valueA,
        valueB,
        details: {
          parsedA: dateA ? dateA.toISOString() : null,
          parsedB: dateB ? dateB.toISOString() : null,
          diffDays: null,
          error: "Unable to parse one or both dates",
        },
      }
    }

    const diffMs = dateA.getTime() - dateB.getTime()
    const diffDays = diffMs / MS_PER_DAY

    let isMatch: boolean
    if (config.tolerance !== undefined && config.tolerance !== null) {
      // Tolerance is in days
      isMatch = Math.abs(diffDays) <= config.tolerance
    } else {
      // Exact match on date (compare timestamps)
      isMatch = dateA.getTime() === dateB.getTime()
    }

    return {
      isMatch,
      valueA,
      valueB,
      details: {
        parsedA: dateA.toISOString(),
        parsedB: dateB.toISOString(),
        diffDays,
      },
    }
  }
}
