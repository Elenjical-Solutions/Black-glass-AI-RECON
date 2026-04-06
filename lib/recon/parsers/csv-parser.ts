import * as Papa from "papaparse"
import { ParsedFile, ParsedRow } from "./types"

export function parseCSV(content: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = result.meta.fields ?? []

  const rows: ParsedRow[] = result.data.map((row, index) => {
    // Ensure all values are strings
    const data: Record<string, string> = {}
    for (const key of headers) {
      const val = row[key]
      data[key] = val !== undefined && val !== null ? String(val) : ""
    }
    return { index, data }
  })

  return {
    headers,
    rows,
    totalRows: rows.length,
    format: "csv",
  }
}
