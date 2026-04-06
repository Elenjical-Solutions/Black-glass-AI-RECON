import { XMLParser } from "fast-xml-parser"
import { ParsedFile, ParsedRow } from "./types"

/**
 * Flatten a nested object into a flat key-value record.
 * Nested keys are joined with ".".
 */
function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = value !== undefined && value !== null ? String(value) : ""
    }
  }

  return result
}

/**
 * Find the first array in the parsed XML structure (the repeating element).
 */
function findRepeatingElement(obj: Record<string, unknown>): unknown[] | null {
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      return value
    }
    if (value !== null && typeof value === "object") {
      const found = findRepeatingElement(value as Record<string, unknown>)
      if (found) return found
    }
  }
  return null
}

export function parseXML(content: string): ParsedFile {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  })

  const parsed = parser.parse(content)

  const repeatingElements = findRepeatingElement(parsed)

  if (!repeatingElements || repeatingElements.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      format: "xml",
    }
  }

  // Flatten each element and collect all unique headers
  const flattenedRows = repeatingElements.map((element) => {
    if (typeof element === "object" && element !== null) {
      return flattenObject(element as Record<string, unknown>)
    }
    return { value: String(element) }
  })

  const headerSet = new Set<string>()
  for (const row of flattenedRows) {
    for (const key of Object.keys(row)) {
      headerSet.add(key)
    }
  }
  const headers = Array.from(headerSet)

  const rows: ParsedRow[] = flattenedRows.map((data, index) => {
    // Ensure every header has a value
    const normalizedData: Record<string, string> = {}
    for (const header of headers) {
      normalizedData[header] = data[header] ?? ""
    }
    return { index, data: normalizedData }
  })

  return {
    headers,
    rows,
    totalRows: rows.length,
    format: "xml",
  }
}
