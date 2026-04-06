import { ParsedFile } from "./types"
import { parseCSV } from "./csv-parser"
import { parseXML } from "./xml-parser"

export function parseFile(content: string, format: "csv" | "xml"): ParsedFile {
  switch (format) {
    case "csv":
      return parseCSV(content)
    case "xml":
      return parseXML(content)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

export function detectFormat(filename: string, content: string): "csv" | "xml" {
  // Check extension first
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "csv") return "csv"
  if (ext === "xml") return "xml"

  // Content sniffing fallback
  const trimmed = content.trimStart()
  if (trimmed.startsWith("<")) return "xml"

  // Default to CSV
  return "csv"
}

export * from "./types"
