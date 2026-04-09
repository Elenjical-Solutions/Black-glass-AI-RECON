"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getResultsAction, getResultDetailsAction } from "@/actions/results-actions"
import type { ExplanationKey } from "@/db/schema/explanation-keys-schema"
import * as XLSX from "xlsx"

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
      // Load ALL results (not paginated)
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

      // Load field details for break results (batch)
      const breakResults = allResults.filter(r => r.result?.status === "break" || r.status === "break")
      const fieldDetailsMap = new Map<string, any[]>()

      // Load details for first 200 breaks (Excel-practical limit)
      const breaksToDetail = breakResults.slice(0, 200)
      for (const r of breaksToDetail) {
        const id = r.id ?? r.result?.id
        if (!id) continue
        const detail = await getResultDetailsAction(id)
        if (detail.status === "success") {
          fieldDetailsMap.set(id, detail.data.fieldDetails)
        }
      }

      // Build key lookup
      const keyById = new Map(explanationKeys.map(k => [k.id, k]))
      const keyByCode = new Map(explanationKeys.map(k => [k.code, k]))

      // ── Tab 1: Summary ──
      const summaryData = [
        ["Black Glass AI RECON — Export"],
        [],
        ["Reconciliation", definitionName],
        ["Category", category ?? "—"],
        ["Department", department ?? "—"],
        ["Source A", fileAName ?? "—"],
        ["Source B", fileBName ?? "—"],
        [],
        ["Metric", "Count", "Percentage"],
        ["Total Rows", totalRows, "100%"],
        ["Matched", matched, totalRows > 0 ? `${((matched / totalRows) * 100).toFixed(1)}%` : "—"],
        ["Breaks", breaks, totalRows > 0 ? `${((breaks / totalRows) * 100).toFixed(1)}%` : "—"],
        ["Explained", explained, breaks > 0 ? `${((explained / breaks) * 100).toFixed(1)}%` : "—"],
        ["Unexplained", unexplained, breaks > 0 ? `${((unexplained / breaks) * 100).toFixed(1)}%` : "—"],
        [],
        ["Exported", new Date().toLocaleString()],
      ]

      // ── Tab 2: All Results ──
      const allResultsData = [
        ["Row Key", "Status", "Explanation Keys", "Confidence", "AI Reasoning"]
      ]
      for (const r of allResults) {
        const rowKey = r.rowKeyValue ?? r.result?.rowKeyValue ?? ""
        const status = r.status ?? r.result?.status ?? ""
        const aiText = (r.aiExplanation ?? r.result?.aiExplanation ?? "") as string
        const expKey = r.explanationKey ?? (r.result?.explanationKeyId ? keyById.get(r.result.explanationKeyId) : null)

        // Parse all [CODE:confidence%] entries
        const entries: Array<{ code: string; conf: string; reasoning: string }> = []
        const parts = aiText.split(/\n\n/).filter(Boolean)
        for (const part of parts) {
          const m = part.match(/^\[([A-Z_]+)(?::(\d+)%)?\]\s*(.*)/)
          if (m) {
            entries.push({ code: m[1], conf: m[2] ?? "", reasoning: m[3].trim() })
          }
        }

        if (entries.length === 0 && expKey) {
          entries.push({ code: (expKey as any).code ?? "", conf: "", reasoning: "" })
        }

        const keyCodes = entries.map(e => e.code).join("; ")
        const confidences = entries.map(e => e.conf ? `${e.conf}%` : "").filter(Boolean).join("; ")
        const reasonings = entries.map(e => `[${e.code}] ${e.reasoning}`).join(" | ")

        allResultsData.push([rowKey, status, keyCodes, confidences, reasonings || "—"])
      }

      // ── Tab 3: Breaks with Field Details ──
      const breaksData = [
        ["Row Key", "Explanation Keys", "Confidence", "Field", "Value A", "Value B", "Numeric Diff", "Match", "AI Reasoning"]
      ]
      for (const r of breakResults) {
        const id = r.id ?? r.result?.id
        const rowKey = r.rowKeyValue ?? r.result?.rowKeyValue ?? ""
        const aiText = (r.aiExplanation ?? r.result?.aiExplanation ?? "") as string
        const expKey = r.explanationKey ?? (r.result?.explanationKeyId ? keyById.get(r.result.explanationKeyId) : null)

        // Parse keys + confidence
        const entries: Array<{ code: string; conf: string; reasoning: string }> = []
        for (const part of aiText.split(/\n\n/).filter(Boolean)) {
          const m = part.match(/^\[([A-Z_]+)(?::(\d+)%)?\]\s*(.*)/)
          if (m) entries.push({ code: m[1], conf: m[2] ?? "", reasoning: m[3].trim() })
        }
        if (entries.length === 0 && expKey) {
          entries.push({ code: (expKey as any).code ?? "", conf: "", reasoning: "" })
        }

        const keyCodes = entries.map(e => e.code).join("; ")
        const confidences = entries.map(e => e.conf ? `${e.conf}%` : "").filter(Boolean).join("; ")
        const reasoning = entries.map(e => `[${e.code}] ${e.reasoning}`).join(" | ")

        const details = id ? (fieldDetailsMap.get(id) ?? []) : []
        if (details.length > 0) {
          for (const fd of details) {
            const fieldName = fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId
            breaksData.push([
              rowKey, keyCodes, confidences,
              fieldName, fd.valueA ?? "", fd.valueB ?? "",
              fd.numericDiff ?? "", fd.isMatch ? "Yes" : "No",
              reasoning || "—"
            ])
          }
        } else {
          breaksData.push([rowKey, keyCodes, confidences, "—", "—", "—", "—", "—", reasoning || "—"])
        }
      }

      // ── Tab 4: Explanation Keys Reference ──
      const keysData = [
        ["Code", "Label", "Description", "Natural Language Rule", "Color", "Auto-Match Pattern"]
      ]
      for (const k of explanationKeys) {
        keysData.push([
          k.code,
          k.label,
          k.description ?? "",
          (k as any).naturalLanguageRule ?? "",
          k.color ?? "",
          k.autoMatchPattern ? JSON.stringify(k.autoMatchPattern) : ""
        ])
      }

      // ── Build workbook ──
      const wb = XLSX.utils.book_new()

      const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
      ws1["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, "Summary")

      const ws2 = XLSX.utils.aoa_to_sheet(allResultsData)
      ws2["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(wb, ws2, "All Results")

      const ws3 = XLSX.utils.aoa_to_sheet(breaksData)
      ws3["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(wb, ws3, "Breaks Detail")

      const ws4 = XLSX.utils.aoa_to_sheet(keysData)
      ws4["!cols"] = [{ wch: 22 }, { wch: 35 }, { wch: 50 }, { wch: 60 }, { wch: 10 }, { wch: 30 }]
      XLSX.utils.book_append_sheet(wb, ws4, "Explanation Keys")

      // Download
      const fileName = `recon_${definitionName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success(`Exported to ${fileName}`)
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
