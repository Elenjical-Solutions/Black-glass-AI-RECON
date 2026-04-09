"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getResultsAction, getBatchFieldDetailsAction } from "@/actions/results-actions"
import type { ExplanationKey } from "@/db/schema/explanation-keys-schema"

interface ExcelExportProps {
  runId: string
  definitionName: string
  category: string | null
  department: string | null
  fileAName: string | null
  fileBName: string | null
  totalRows: number
  matched: number
  breaks: number
  explained: number
  unexplained: number
  explanationKeys: ExplanationKey[]
  fieldMappingNames: Record<string, string>
}

function hexToArgb(hex: string): string {
  return `FF${hex.replace("#", "").padEnd(6, "0")}`
}

function lightenHex(hex: string, amount = 0.82): string {
  const c = hex.replace("#", "")
  const r = Math.round(parseInt(c.substring(0, 2), 16) + (255 - parseInt(c.substring(0, 2), 16)) * amount)
  const g = Math.round(parseInt(c.substring(2, 4), 16) + (255 - parseInt(c.substring(2, 4), 16)) * amount)
  const b = Math.round(parseInt(c.substring(4, 6), 16) + (255 - parseInt(c.substring(4, 6), 16)) * amount)
  return `FF${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

export function ExcelExport(props: ExcelExportProps) {
  const {
    runId, definitionName, category, department, fileAName, fileBName,
    totalRows, matched, breaks, explained, unexplained, explanationKeys, fieldMappingNames,
  } = props
  const [dialogOpen, setDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [includeMatches, setIncludeMatches] = useState(true)
  const [includeBreaks, setIncludeBreaks] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeKeys, setIncludeKeys] = useState(true)

  async function handleExport() {
    setExporting(true)
    setDialogOpen(false)

    try {
      const ExcelJS = (await import("exceljs")).default
      toast.info("Loading results...")

      // Load all results
      const allResults: any[] = []
      let page = 1
      let hasMore = true
      while (hasMore) {
        const res = await getResultsAction(runId, {}, page, 200)
        if (res.status === "success") {
          allResults.push(...res.data.results)
          hasMore = res.data.results.length === 200
          page++
        } else { hasMore = false }
      }

      // Batch load ALL field details in one query
      toast.info("Loading field details...")
      const resultIds = allResults.map(r => r.id ?? r.result?.id).filter(Boolean) as string[]
      let fieldDetailsMap = new Map<string, any[]>()
      // Process in chunks of 500 IDs (Postgres parameter limit)
      for (let i = 0; i < resultIds.length; i += 500) {
        const chunk = resultIds.slice(i, i + 500)
        const res = await getBatchFieldDetailsAction(chunk)
        if (res.status === "success") {
          for (const [k, v] of Object.entries(res.data)) {
            fieldDetailsMap.set(k, v)
          }
        }
      }

      // Discover field names
      const allFieldNames: string[] = []
      const fieldNameSet = new Set<string>()
      for (const details of fieldDetailsMap.values()) {
        for (const fd of details) {
          const name = fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId
          if (!fieldNameSet.has(name)) { fieldNameSet.add(name); allFieldNames.push(name) }
        }
      }

      const keyById = new Map(explanationKeys.map(k => [k.id, k]))

      // ── Light-mode Excel styles (white/light backgrounds, dark text) ──
      const headerFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }
      const headerFont: any = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
      const matchStatusFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } }
      const matchStatusFont: any = { color: { argb: "FF166534" }, bold: true }
      const breakStatusFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }
      const breakStatusFont: any = { color: { argb: "FF991B1B" }, bold: true }
      const missingFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } }
      const missingFont: any = { color: { argb: "FF92400E" }, bold: true }
      const mismatchCellFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } }
      const mismatchCellFont: any = { color: { argb: "FFDC2626" } }
      const matchCellFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } }
      const titleFont: any = { bold: true, size: 14, color: { argb: "FF1e40af" } }

      function parseKeys(aiText: string | null, expKey: any) {
        const entries: Array<{ code: string; conf: string; reasoning: string; color: string }> = []
        if (aiText) {
          for (const part of aiText.split(/\n\n/).filter(Boolean)) {
            const m = part.match(/^\[([A-Z_]+)(?::(\d+)%)?\]\s*(.*)/)
            if (m) {
              const k = explanationKeys.find(ek => ek.code === m[1])
              entries.push({ code: m[1], conf: m[2] ?? "", reasoning: m[3].trim(), color: k?.color ?? "#6366f1" })
            }
          }
        }
        if (entries.length === 0 && expKey) entries.push({ code: expKey.code ?? "", conf: "", reasoning: "", color: expKey.color ?? "#6366f1" })
        return entries
      }

      const wb = new ExcelJS.Workbook()
      wb.creator = "Black Glass AI RECON"

      // ═══ Tab: Summary ═══
      if (includeSummary) {
        const ws = wb.addWorksheet("Summary")
        ws.columns = [{ width: 22 }, { width: 18 }, { width: 12 }]
        ws.addRow([definitionName]).font = titleFont
        ws.addRow([])
        ws.addRow(["Category", category ?? "—"]).getCell(1).font = { bold: true }
        ws.addRow(["Department", department ?? "—"]).getCell(1).font = { bold: true }
        ws.addRow(["Source A", fileAName ?? "—"]).getCell(1).font = { bold: true }
        ws.addRow(["Source B", fileBName ?? "—"]).getCell(1).font = { bold: true }
        ws.addRow([])
        ws.addRow(["Metric", "Count", "%"]).eachCell((c: any) => { c.fill = headerFill; c.font = headerFont })

        const addM = (label: string, val: number, pct: string, fill: any, font: any) => {
          const row = ws.addRow([label, val, pct])
          row.getCell(1).font = { bold: true }
          row.getCell(2).font = { ...font, size: 12 }
          row.getCell(2).fill = fill
        }
        addM("Total Rows", totalRows, "100%", { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }, { bold: true })
        addM("Matched", matched, totalRows > 0 ? `${((matched / totalRows) * 100).toFixed(1)}%` : "—", matchStatusFill, matchStatusFont)
        addM("Breaks", breaks, totalRows > 0 ? `${((breaks / totalRows) * 100).toFixed(1)}%` : "—", breakStatusFill, breakStatusFont)
        addM("Explained", explained, breaks > 0 ? `${((explained / breaks) * 100).toFixed(1)}%` : "—",
          { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } }, { color: { argb: "FF92400E" }, bold: true })
        addM("Unexplained", unexplained, breaks > 0 ? `${((unexplained / breaks) * 100).toFixed(1)}%` : "—",
          { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } }, { color: { argb: "FF9A3412" }, bold: true })
        ws.addRow([])
        ws.addRow(["Exported", new Date().toLocaleString()])
      }

      // ═══ Helper: build results sheet ═══
      function buildSheet(name: string, rows: any[], showReasoning: boolean) {
        const ws = wb.addWorksheet(name)

        const headers: string[] = ["Row Key", "Status", "Explanation Keys", "Confidence"]
        for (const fn of allFieldNames) headers.push(`${fn} (A)`, `${fn} (B)`, `${fn} (Diff)`)
        if (showReasoning) headers.push("AI Reasoning")

        ws.addRow(headers)
        const hr = ws.getRow(1)
        hr.height = 26
        hr.eachCell((cell: any, col: number) => {
          cell.font = headerFont
          cell.alignment = { vertical: "middle", wrapText: true }
          if (col <= 4 || (showReasoning && col === headers.length)) {
            cell.fill = headerFill
          } else {
            const offset = (col - 5) % 3
            if (offset === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } } // A blue
            else if (offset === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0891B2" } } // B cyan
            else cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B7280" } } // Diff gray
          }
        })

        const colW: any[] = [{ width: 20 }, { width: 10 }, { width: 26 }, { width: 10 }]
        for (const _ of allFieldNames) colW.push({ width: 15 }, { width: 15 }, { width: 11 })
        if (showReasoning) colW.push({ width: 55 })
        ws.columns = colW
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
        ws.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }]

        for (const r of rows) {
          const id = r.id ?? r.result?.id
          const status = r.status ?? r.result?.status ?? ""
          const aiText = (r.aiExplanation ?? r.result?.aiExplanation ?? "") as string
          const expKey = r.explanationKey ?? (r.explanationKeyId ? keyById.get(r.explanationKeyId) : null)
          const entries = parseKeys(aiText, expKey)
          const details = id ? (fieldDetailsMap.get(id) ?? []) : []

          const detailByField = new Map<string, any>()
          for (const fd of details) {
            detailByField.set(fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId, fd)
          }

          const rowData: any[] = [
            r.rowKeyValue ?? "",
            status,
            entries.map(e => e.code).join("; "),
            entries.map(e => e.conf ? `${e.conf}%` : "").filter(Boolean).join("; "),
          ]
          for (const fn of allFieldNames) {
            const fd = detailByField.get(fn)
            rowData.push(fd?.valueA ?? "", fd?.valueB ?? "", fd?.numericDiff ?? "")
          }
          if (showReasoning) rowData.push(entries.map(e => `[${e.code}] ${e.reasoning}`).join(" | ") || "")

          const excelRow = ws.addRow(rowData)

          // Status cell color
          const sc = excelRow.getCell(2)
          if (status === "match") { sc.fill = matchStatusFill; sc.font = matchStatusFont }
          else if (status === "break") { sc.fill = breakStatusFill; sc.font = breakStatusFont }
          else { sc.fill = missingFill; sc.font = missingFont }

          // Key cell color
          if (entries.length > 0 && entries[0].color) {
            const kc = excelRow.getCell(3)
            kc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightenHex(entries[0].color) } }
            kc.font = { color: { argb: hexToArgb(entries[0].color) }, bold: true, size: 10 }
          }

          // Field cells: red mismatch, green match
          for (let fi = 0; fi < allFieldNames.length; fi++) {
            const fd = detailByField.get(allFieldNames[fi])
            if (!fd) continue
            const cA = 5 + fi * 3, cB = cA + 1, cD = cA + 2
            if (!fd.isMatch) {
              excelRow.getCell(cA).fill = mismatchCellFill; excelRow.getCell(cA).font = mismatchCellFont
              excelRow.getCell(cB).fill = mismatchCellFill; excelRow.getCell(cB).font = mismatchCellFont
              excelRow.getCell(cD).fill = mismatchCellFill; excelRow.getCell(cD).font = { ...mismatchCellFont, bold: true }
            } else {
              excelRow.getCell(cA).fill = matchCellFill
              excelRow.getCell(cB).fill = matchCellFill
            }
          }
        }
      }

      // Build sheets based on user selection
      if (includeMatches && includeBreaks) {
        buildSheet("All Results", allResults, false)
      }
      if (includeBreaks) {
        const breakOnly = allResults.filter(r => (r.status ?? r.result?.status) !== "match")
        buildSheet("Breaks Detail", breakOnly, true)
      }
      if (includeMatches && !includeBreaks) {
        const matchOnly = allResults.filter(r => (r.status ?? r.result?.status) === "match")
        buildSheet("Matches", matchOnly, false)
      }

      // Explanation Keys tab
      if (includeKeys) {
        const ws = wb.addWorksheet("Explanation Keys")
        ws.columns = [{ width: 4 }, { width: 24 }, { width: 36 }, { width: 50 }, { width: 65 }]
        ws.addRow(["", "Code", "Label", "Description", "Natural Language Rule"]).eachCell((c: any) => { c.fill = headerFill; c.font = headerFont })
        for (const k of explanationKeys) {
          const row = ws.addRow(["", k.code, k.label, k.description ?? "", (k as any).naturalLanguageRule ?? ""])
          row.getCell(4).alignment = { wrapText: true }
          row.getCell(5).alignment = { wrapText: true }
          if (k.color) {
            row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(k.color) } }
            row.getCell(2).font = { color: { argb: hexToArgb(k.color) }, bold: true }
          }
        }
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `recon_${definitionName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel exported")
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setDialogOpen(true)} disabled={exporting}>
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {exporting ? "Exporting..." : "Export Excel"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export to Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Choose what to include in the export:</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeSummary} onCheckedChange={v => setIncludeSummary(!!v)} />
              <div>
                <span className="text-sm font-medium">Summary tab</span>
                <p className="text-xs text-muted-foreground">Recon info, matched/break/explained counts</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeMatches} onCheckedChange={v => setIncludeMatches(!!v)} />
              <div>
                <span className="text-sm font-medium">Matched rows</span>
                <p className="text-xs text-muted-foreground">{matched.toLocaleString()} rows where all fields match</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeBreaks} onCheckedChange={v => setIncludeBreaks(!!v)} />
              <div>
                <span className="text-sm font-medium">Breaks &amp; differences</span>
                <p className="text-xs text-muted-foreground">{breaks.toLocaleString()} breaks with field details + AI reasoning</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeKeys} onCheckedChange={v => setIncludeKeys(!!v)} />
              <div>
                <span className="text-sm font-medium">Explanation keys reference</span>
                <p className="text-xs text-muted-foreground">{explanationKeys.length} keys with NL rules</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={!includeMatches && !includeBreaks}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
