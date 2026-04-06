import { ParsedRow } from "./parsers/types"

export interface KeyFieldPair {
  fieldA: string
  fieldB: string
}

export interface RowMatchResult {
  matchedPairs: Array<{ rowA: ParsedRow; rowB: ParsedRow; keyValue: string }>
  unmatchedA: ParsedRow[] // in A but not B
  unmatchedB: ParsedRow[] // in B but not A
}

function buildCompositeKey(row: ParsedRow, fields: string[]): string {
  return fields.map((field) => row.data[field] ?? "").join("|")
}

export function matchRows(
  rowsA: ParsedRow[],
  rowsB: ParsedRow[],
  keyFields: KeyFieldPair[]
): RowMatchResult {
  const fieldsA = keyFields.map((kf) => kf.fieldA)
  const fieldsB = keyFields.map((kf) => kf.fieldB)

  // Build map from composite key -> ParsedRow for rowsA
  const mapA = new Map<string, ParsedRow>()
  for (const row of rowsA) {
    const key = buildCompositeKey(row, fieldsA)
    mapA.set(key, row)
  }

  const matchedPairs: Array<{ rowA: ParsedRow; rowB: ParsedRow; keyValue: string }> = []
  const unmatchedB: ParsedRow[] = []

  // Iterate rowsB and look up matches
  for (const rowB of rowsB) {
    const key = buildCompositeKey(rowB, fieldsB)
    const rowA = mapA.get(key)

    if (rowA) {
      matchedPairs.push({ rowA, rowB, keyValue: key })
      mapA.delete(key) // Remove matched row from map
    } else {
      unmatchedB.push(rowB)
    }
  }

  // Remaining in map are unmatched A rows
  const unmatchedA: ParsedRow[] = Array.from(mapA.values())

  return { matchedPairs, unmatchedA, unmatchedB }
}
