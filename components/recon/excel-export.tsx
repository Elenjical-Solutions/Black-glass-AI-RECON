"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getResultsAction, getResultDetailsAction } from "@/actions/results-actions"
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

function lightenHex(hex: string, amount = 0.85): string {
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
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    toast.info("Generating Excel... loading all results")

    try {
      const ExcelJS = (await import("exceljs")).default

      // ── Load all results ──
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

      // ── Load field details for ALL results (not just breaks) ──
      toast.info(`Loading field details for ${Math.min(allResults.length, 500)} rows...`)
      const fieldDetailsMap = new Map<string, any[]>()
      for (const r of allResults.slice(0, 500)) {
        const id = r.id ?? r.result?.id
        if (!id) continue
        const detail = await getResultDetailsAction(id)
        if (detail.status === "success") {
          fieldDetailsMap.set(id, detail.data.fieldDetails)
        }
      }

      // ── Discover all field names from the details ──
      const allFieldNames: string[] = []
      const fieldNameSet = new Set<string>()
      for (const details of fieldDetailsMap.values()) {
        for (const fd of details) {
          const name = fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId
          if (!fieldNameSet.has(name)) {
            fieldNameSet.add(name)
            allFieldNames.push(name)
          }
        }
      }

      const keyById = new Map(explanationKeys.map(k => [k.id, k]))

      // ── Styles ──
      const headerFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1f2e" } }
      const headerFont: any = { bold: true, color: { argb: "FFe2e8f0" }, size: 10 }
      const matchFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0d3320" } }
      const matchFont: any = { color: { argb: "FF4ade80" }, bold: true }
      const breakFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b1111" } }
      const breakFont: any = { color: { argb: "FFf87171" }, bold: true }
      const mismatchBg: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0F0" } }
      const mismatchFont: any = { color: { argb: "FFdc2626" } }
      const matchCellBg: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FFF4" } }
      const titleFont: any = { bold: true, size: 14, color: { argb: "FF38bdf8" } }

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
        if (entries.length === 0 && expKey) {
          entries.push({ code: expKey.code ?? "", conf: "", reasoning: "", color: expKey.color ?? "#6366f1" })
        }
        return entries
      }

      const wb = new ExcelJS.Workbook()
      wb.creator = "Black Glass AI RECON"

      // ═══ Tab 1: Summary ═══
      const ws1 = wb.addWorksheet("Summary")
      ws1.columns = [{ width: 22 }, { width: 18 }, { width: 12 }]
      ws1.addRow([definitionName]).font = titleFont
      ws1.addRow([])
      ws1.addRow(["Category", category ?? "—"])
      ws1.addRow(["Department", department ?? "—"])
      ws1.addRow(["Source A", fileAName ?? "—"])
      ws1.addRow(["Source B", fileBName ?? "—"])
      ws1.addRow([])
      ws1.addRow(["Metric", "Count", "%"]).eachCell((c: any) => { c.fill = headerFill; c.font = headerFont })

      const addMetric = (label: string, value: number, pct: string, fill: any, font: any) => {
        const row = ws1.addRow([label, value, pct])
        row.eachCell((c: any) => { c.fill = fill; c.font = font })
      }
      addMetric("Total Rows", totalRows, "100%", { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e2433" } }, { bold: true })
      addMetric("Matched", matched, totalRows > 0 ? `${((matched / totalRows) * 100).toFixed(1)}%` : "—", matchFill, matchFont)
      addMetric("Breaks", breaks, totalRows > 0 ? `${((breaks / totalRows) * 100).toFixed(1)}%` : "—", breakFill, breakFont)
      addMetric("Explained", explained, breaks > 0 ? `${((explained / breaks) * 100).toFixed(1)}%` : "—",
        { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b2e0a" } }, { color: { argb: "FFfbbf24" }, bold: true })
      addMetric("Unexplained", unexplained, breaks > 0 ? `${((unexplained / breaks) * 100).toFixed(1)}%` : "—",
        { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b1a0a" } }, { color: { argb: "FFfb923c" }, bold: true })
      ws1.addRow([])
      ws1.addRow(["Exported", new Date().toLocaleString()])

      // ═══ Helper: build a results sheet with field columns ═══
      function buildResultsSheet(name: string, rows: any[], includeReasoning: boolean) {
        const ws = wb.addWorksheet(name)

        // Header: Row Key | Status | Keys | Confidence | [field (A) | field (B) | field (Diff)] ... | Reasoning?
        const headers: string[] = ["Row Key", "Status", "Explanation Keys", "Confidence"]
        for (const fn of allFieldNames) {
          headers.push(`${fn} (A)`, `${fn} (B)`, `${fn} (Diff)`)
        }
        if (includeReasoning) headers.push("AI Reasoning")

        ws.addRow(headers)

        // Style header — two-level: fixed cols are dark, field cols alternate light blue/light cyan for A/B
        const headerRow = ws.getRow(1)
        headerRow.height = 28
        headerRow.eachCell((cell: any, colNumber: number) => {
          cell.font = headerFont
          cell.alignment = { vertical: "middle", wrapText: true }
          if (colNumber <= 4) {
            cell.fill = headerFill
          } else if (includeReasoning && colNumber === headers.length) {
            cell.fill = headerFill
          } else {
            // Field columns: A=blue tint, B=cyan tint, Diff=gray
            const fieldOffset = (colNumber - 5) % 3
            if (fieldOffset === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } } // A
            else if (fieldOffset === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a4040" } } // B
            else cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2a2a3a" } } // Diff
          }
        })

        // Column widths
        const colWidths: any[] = [
          { width: 22 }, { width: 10 }, { width: 28 }, { width: 10 },
        ]
        for (const _ of allFieldNames) {
          colWidths.push({ width: 16 }, { width: 16 }, { width: 12 })
        }
        if (includeReasoning) colWidths.push({ width: 60 })
        ws.columns = colWidths

        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
        // Freeze first row + first 4 columns
        ws.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }]

        // Data rows
        for (const r of rows) {
          const id = r.id ?? r.result?.id
          const status = r.status ?? r.result?.status ?? ""
          const rowKey = r.rowKeyValue ?? r.result?.rowKeyValue ?? ""
          const aiText = (r.aiExplanation ?? r.result?.aiExplanation ?? "") as string
          const expKey = r.explanationKey ?? (r.explanationKeyId ? keyById.get(r.explanationKeyId) : null)
          const entries = parseKeys(aiText, expKey)
          const details = id ? (fieldDetailsMap.get(id) ?? []) : []

          // Build field lookup: fieldName -> detail
          const detailByField = new Map<string, any>()
          for (const fd of details) {
            const name = fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId
            detailByField.set(name, fd)
          }

          const rowData: any[] = [
            rowKey,
            status,
            entries.map(e => e.code).join("; "),
            entries.map(e => e.conf ? `${e.conf}%` : "").filter(Boolean).join("; "),
          ]

          // Field values
          const mismatchCols: number[] = []
          for (let fi = 0; fi < allFieldNames.length; fi++) {
            const fd = detailByField.get(allFieldNames[fi])
            const colStart = 5 + fi * 3 // 1-indexed column numbers
            if (fd) {
              rowData.push(fd.valueA ?? "", fd.valueB ?? "", fd.numericDiff ?? "")
              if (!fd.isMatch) {
                mismatchCols.push(colStart, colStart + 1, colStart + 2)
              }
            } else {
              rowData.push("", "", "")
            }
          }

          if (includeReasoning) {
            rowData.push(entries.map(e => `[${e.code}] ${e.reasoning}`).join(" | ") || "")
          }

          const excelRow = ws.addRow(rowData)

          // Color status cell
          const statusCell = excelRow.getCell(2)
          if (status === "match") {
            statusCell.fill = matchFill; statusCell.font = matchFont
          } else if (status === "break") {
            statusCell.fill = breakFill; statusCell.font = breakFont
          } else if (status === "missing_a" || status === "missing_b") {
            statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b2e0a" } }
            statusCell.font = { color: { argb: "FFfbbf24" } }
          }

          // Color key cell
          if (entries.length > 0 && entries[0].color) {
            const keyCell = excelRow.getCell(3)
            keyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightenHex(entries[0].color, 0.88) } }
            keyCell.font = { color: { argb: hexToArgb(entries[0].color) }, bold: true, size: 10 }
          }

          // Color mismatched field cells RED, matched GREEN
          for (let fi = 0; fi < allFieldNames.length; fi++) {
            const fd = detailByField.get(allFieldNames[fi])
            if (!fd) continue
            const colA = 5 + fi * 3
            const colB = colA + 1
            const colDiff = colA + 2
            if (!fd.isMatch) {
              excelRow.getCell(colA).fill = mismatchBg
              excelRow.getCell(colA).font = mismatchFont
              excelRow.getCell(colB).fill = mismatchBg
              excelRow.getCell(colB).font = mismatchFont
              excelRow.getCell(colDiff).fill = mismatchBg
              excelRow.getCell(colDiff).font = { ...mismatchFont, bold: true }
            } else {
              excelRow.getCell(colA).fill = matchCellBg
              excelRow.getCell(colB).fill = matchCellBg
            }
          }
        }
      }

      // ═══ Tab 2: All Results ═══
      buildResultsSheet("All Results", allResults, false)

      // ═══ Tab 3: Breaks Only ═══
      const breakOnly = allResults.filter(r => (r.status ?? r.result?.status) === "break")
      buildResultsSheet("Breaks Detail", breakOnly, true)

      // ═══ Tab 4: Explanation Keys ═══
      const ws4 = wb.addWorksheet("Explanation Keys")
      ws4.columns = [{ width: 4 }, { width: 24 }, { width: 36 }, { width: 50 }, { width: 65 }]
      ws4.addRow(["", "Code", "Label", "Description", "Natural Language Rule"])
      ws4.getRow(1).eachCell((c: any) => { c.fill = headerFill; c.font = headerFont })

      for (const k of explanationKeys) {
        const row = ws4.addRow(["", k.code, k.label, k.description ?? "", (k as any).naturalLanguageRule ?? ""])
        row.getCell(4).alignment = { wrapText: true }
        row.getCell(5).alignment = { wrapText: true }
        if (k.color) {
          row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(k.color) } }
          row.getCell(2).font = { color: { argb: hexToArgb(k.color) }, bold: true }
        }
      }

      // ── Download ──
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
    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleExport} disabled={exporting}>
      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {exporting ? "Exporting..." : "Export Excel"}
    </Button>
  )
}
