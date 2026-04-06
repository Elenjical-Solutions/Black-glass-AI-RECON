export interface ParsedRow {
  index: number
  data: Record<string, string>
}

export interface ParsedFile {
  headers: string[]
  rows: ParsedRow[]
  totalRows: number
  format: "csv" | "xml"
}
