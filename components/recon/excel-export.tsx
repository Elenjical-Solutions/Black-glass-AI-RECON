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
  const clean = hex.replace("#", "")
  return `FF${clean.padEnd(6, "0")}`
}

function lightenHex(hex: string, amount: number = 0.85): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `FF${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`
}

export function ExcelExport({
  runId,
  definitionName,
  category,
  department,
  fileAName,
  fileBName,
  totalRows,
  matched,
  breaks,
  explained,
  unexplained,
  explanationKeys,
  fieldMappingNames,
}: ExcelExportProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    toast.info("Generating Excel export...")

    try {
      // Dynamic import to avoid SSR issues
      const ExcelJS = (await import("exceljs")).default

      // Load ALL results
      const allResults: any[] = []
      let page = 1
      let hasMore = true
      while (hasMore) {
        const res = await getResultsAction(runId, {}, page, 200)
        if (res.status === "success") {
          allResults.push(...res.data.results)
          hasMore = res.data.results.length === 200
          page++
        } else {
          hasMore = false
        }
      }

      // Load field details for breaks (first 200)
      const breakResults = allResults.filter(r => (r.status ?? r.result?.status) === "break")
      const fieldDetailsMap = new Map<string, any[]>()
      for (const r of breakResults.slice(0, 200)) {
        const id = r.id ?? r.result?.id
        if (!id) continue
        const detail = await getResultDetailsAction(id)
        if (detail.status === "success") {
          fieldDetailsMap.set(id, detail.data.fieldDetails)
        }
      }

      const keyById = new Map(explanationKeys.map(k => [k.id, k]))
      const wb = new ExcelJS.Workbook()
      wb.creator = "Black Glass AI RECON"
      wb.created = new Date()

      // ── Styles ──
      const headerFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1f2e" } }
      const headerFont: any = { bold: true, color: { argb: "FFe2e8f0" }, size: 11 }
      const matchFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0d3320" } }
      const matchFont: any = { color: { argb: "FF4ade80" }, bold: true }
      const breakFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b1111" } }
      const breakFont: any = { color: { argb: "FFf87171" }, bold: true }
      const explainedFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b2e0a" } }
      const explainedFont: any = { color: { argb: "FFfbbf24" } }
      const titleFont: any = { bold: true, size: 14, color: { argb: "FF38bdf8" } }
      const subtitleFont: any = { bold: true, size: 11 }

      function styleHeader(ws: any) {
        const row = ws.getRow(1)
        row.eachCell((cell: any) => {
          cell.fill = headerFill
          cell.font = headerFont
          cell.alignment = { vertical: "middle" }
        })
        row.height = 24
      }

      function autoFilter(ws: any, cols: number) {
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } }
      }

      // ── Helper: parse keys from aiExplanation ──
      function parseKeys(aiText: string | null, expKey: any): Array<{ code: string; conf: string; reasoning: string; color: string }> {
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

      // ═══ Tab 1: Summary ═══
      const ws1 = wb.addWorksheet("Summary")
      ws1.columns = [{ width: 22 }, { width: 20 }, { width: 15 }]

      ws1.addRow([definitionName]).font = titleFont
      ws1.addRow([])
      ws1.addRow(["Category", category ?? "—"])
      ws1.addRow(["Department", department ?? "—"])
      ws1.addRow(["Source A", fileAName ?? "—"])
      ws1.addRow(["Source B", fileBName ?? "—"])
      ws1.addRow([])

      const metricsStart = ws1.rowCount + 1
      ws1.addRow(["Metric", "Count", "%"]).eachCell((c: any) => { c.fill = headerFill; c.font = headerFont })

      const addMetric = (label: string, value: number, pct: string, fill: any, font: any) => {
        const row = ws1.addRow([label, value, pct])
        row.getCell(1).font = font
        row.getCell(2).font = { ...font, size: 12 }
        row.eachCell((c: any) => { c.fill = fill })
      }

      addMetric("Total Rows", totalRows, "100%", { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e2433" } }, subtitleFont)
      addMetric("Matched", matched, totalRows > 0 ? `${((matched / totalRows) * 100).toFixed(1)}%` : "—", matchFill, matchFont)
      addMetric("Breaks", breaks, totalRows > 0 ? `${((breaks / totalRows) * 100).toFixed(1)}%` : "—", breakFill, breakFont)
      addMetric("Explained", explained, breaks > 0 ? `${((explained / breaks) * 100).toFixed(1)}%` : "—", explainedFill, explainedFont)
      addMetric("Unexplained", unexplained, breaks > 0 ? `${((unexplained / breaks) * 100).toFixed(1)}%` : "—",
        { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b1a0a" } },
        { color: { argb: "FFfb923c" }, bold: true })

      ws1.addRow([])
      ws1.addRow(["Exported", new Date().toLocaleString()])

      // ═══ Tab 2: All Results ═══
      const ws2 = wb.addWorksheet("All Results")
      ws2.columns = [{ width: 22 }, { width: 12 }, { width: 30 }, { width: 12 }, { width: 70 }]
      ws2.addRow(["Row Key", "Status", "Explanation Keys", "Confidence", "AI Reasoning"])
      styleHeader(ws2)
      autoFilter(ws2, 5)

      for (const r of allResults) {
        const status = r.status ?? r.result?.status ?? ""
        const aiText = (r.aiExplanation ?? r.result?.aiExplanation ?? "") as string
        const expKey = r.explanationKey ?? (r.explanationKeyId ? keyById.get(r.explanationKeyId) : null)
        const entries = parseKeys(aiText, expKey)

        const keyCodes = entries.map(e => e.code).join("; ")
        const confidences = entries.map(e => e.conf ? `${e.conf}%` : "").filter(Boolean).join("; ")
        const reasonings = entries.map(e => `[${e.code}] ${e.reasoning}`).join(" | ")

        const row = ws2.addRow([r.rowKeyValue ?? "", status, keyCodes, confidences, reasonings || "—"])

        // Color the status cell
        const statusCell = row.getCell(2)
        if (status === "match") {
          statusCell.fill = matchFill; statusCell.font = matchFont
        } else if (status === "break") {
          if (entries.length > 0 && entries[0].code) {
            statusCell.fill = explainedFill; statusCell.font = explainedFont
          } else {
            statusCell.fill = breakFill; statusCell.font = breakFont
          }
        }

        // Color the key cell with the first key's color
        if (entries.length > 0 && entries[0].color) {
          const keyCell = row.getCell(3)
          keyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightenHex(entries[0].color) } }
          keyCell.font = { color: { argb: hexToArgb(entries[0].color) }, bold: true }
        }
      }

      // ═══ Tab 3: Breaks Detail ═══
      const ws3 = wb.addWorksheet("Breaks Detail")
      ws3.columns = [{ width: 22 }, { width: 28 }, { width: 12 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 }, { width: 8 }, { width: 60 }]
      ws3.addRow(["Row Key", "Explanation Keys", "Confidence", "Field", "Value A", "Value B", "Diff", "Match", "AI Reasoning"])
      styleHeader(ws3)
      autoFilter(ws3, 9)

      for (const r of breakResults) {
        const id = r.id ?? r.result?.id
        const rowKey = r.rowKeyValue ?? r.result?.rowKeyValue ?? ""
        const aiText = (r.aiExplanation ?? r.result?.aiExplanation ?? "") as string
        const expKey = r.explanationKey ?? (r.explanationKeyId ? keyById.get(r.explanationKeyId) : null)
        const entries = parseKeys(aiText, expKey)

        const keyCodes = entries.map(e => e.code).join("; ")
        const confidences = entries.map(e => e.conf ? `${e.conf}%` : "").filter(Boolean).join("; ")
        const reasoning = entries.map(e => `[${e.code}] ${e.reasoning}`).join(" | ")

        const details = id ? (fieldDetailsMap.get(id) ?? []) : []
        const rows = details.length > 0
          ? details.map(fd => [rowKey, keyCodes, confidences, fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId, fd.valueA ?? "", fd.valueB ?? "", fd.numericDiff ?? "", fd.isMatch ? "Yes" : "No", reasoning])
          : [[rowKey, keyCodes, confidences, "—", "—", "—", "—", "—", reasoning]]

        for (const rowData of rows) {
          const row = ws3.addRow(rowData)
          // Color match/no-match field
          const matchCell = row.getCell(8)
          if (rowData[7] === "No") {
            matchCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b1111" } }
            matchCell.font = { color: { argb: "FFf87171" }, bold: true }
          } else if (rowData[7] === "Yes") {
            matchCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0d3320" } }
            matchCell.font = { color: { argb: "FF4ade80" } }
          }
          // Color key cell
          if (entries.length > 0 && entries[0].color) {
            const keyCell = row.getCell(2)
            keyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightenHex(entries[0].color) } }
            keyCell.font = { color: { argb: hexToArgb(entries[0].color) }, bold: true }
          }
        }
      }

      // ═══ Tab 4: Explanation Keys ═══
      const ws4 = wb.addWorksheet("Explanation Keys")
      ws4.columns = [{ width: 8 }, { width: 24 }, { width: 36 }, { width: 50 }, { width: 65 }, { width: 30 }]
      ws4.addRow(["", "Code", "Label", "Description", "Natural Language Rule", "Auto-Match"])
      styleHeader(ws4)

      for (const k of explanationKeys) {
        const row = ws4.addRow([
          "",
          k.code,
          k.label,
          k.description ?? "",
          (k as any).naturalLanguageRule ?? "",
          k.autoMatchPattern ? JSON.stringify(k.autoMatchPattern) : ""
        ])
        // Color indicator in first cell
        if (k.color) {
          const colorCell = row.getCell(1)
          colorCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(k.color) } }
        }
        // Tint the code cell
        if (k.color) {
          const codeCell = row.getCell(2)
          codeCell.font = { color: { argb: hexToArgb(k.color) }, bold: true }
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
      toast.success("Excel exported with color coding")
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
