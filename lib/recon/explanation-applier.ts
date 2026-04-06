export interface ExplanationKeyRule {
  id: string
  code: string
  label: string
  autoMatchPattern: {
    field?: string
    diffRange?: [number, number]
    valueAPattern?: string
    valueBPattern?: string
    category?: string
  } | null
}

export interface AppliedExplanation {
  resultIndex: number
  explanationKeyId: string
  explanationKeyCode: string
  reason: string
}

export function applyExplanationKeys(
  results: Array<{
    index: number
    status: string
    fields: Array<{
      fieldNameA: string
      valueA: string | null
      valueB: string | null
      numericDiff?: number
      isMatch: boolean
    }>
  }>,
  explanationKeys: ExplanationKeyRule[]
): AppliedExplanation[] {
  const applied: AppliedExplanation[] = []

  for (const result of results) {
    // Only try to explain breaks
    if (result.status !== "break") continue

    for (const key of explanationKeys) {
      if (!key.autoMatchPattern) continue

      const pattern = key.autoMatchPattern
      let matched = false
      let reason = ""

      // Check each mismatched field against the pattern
      for (const field of result.fields) {
        if (field.isMatch) continue // Only look at breaking fields

        // Field name filter
        if (pattern.field && field.fieldNameA !== pattern.field) continue

        let fieldMatches = true
        const reasons: string[] = []

        // Diff range check
        if (pattern.diffRange && field.numericDiff !== undefined) {
          const [min, max] = pattern.diffRange
          const absDiff = Math.abs(field.numericDiff)
          if (absDiff < min || absDiff > max) {
            fieldMatches = false
          } else {
            reasons.push(`diff ${field.numericDiff} within range [${min}, ${max}]`)
          }
        }

        // Value A pattern check
        if (pattern.valueAPattern && field.valueA !== null) {
          try {
            const regex = new RegExp(pattern.valueAPattern)
            if (!regex.test(field.valueA)) {
              fieldMatches = false
            } else {
              reasons.push(`valueA matches /${pattern.valueAPattern}/`)
            }
          } catch {
            fieldMatches = false
          }
        }

        // Value B pattern check
        if (pattern.valueBPattern && field.valueB !== null) {
          try {
            const regex = new RegExp(pattern.valueBPattern)
            if (!regex.test(field.valueB)) {
              fieldMatches = false
            } else {
              reasons.push(`valueB matches /${pattern.valueBPattern}/`)
            }
          } catch {
            fieldMatches = false
          }
        }

        if (fieldMatches) {
          matched = true
          reason = `Auto-matched on field "${field.fieldNameA}": ${reasons.join(", ") || "pattern matched"}`
          break
        }
      }

      if (matched) {
        applied.push({
          resultIndex: result.index,
          explanationKeyId: key.id,
          explanationKeyCode: key.code,
          reason,
        })
        break // Only apply the first matching explanation key per result
      }
    }
  }

  return applied
}
