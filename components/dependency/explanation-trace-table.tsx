"use client"

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface TraceResult {
  rowKeyValue: string
  explanationKeyCode: string
  explanationKeyLabel: string
  explanationKeyColor: string
  parentDefinitionName: string
}

interface ExplanationTraceTableProps {
  results: TraceResult[]
}

const MAX_DISPLAY = 50

export function ExplanationTraceTable({ results }: ExplanationTraceTableProps) {
  const displayed = results.slice(0, MAX_DISPLAY)
  const remaining = results.length - MAX_DISPLAY

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        No propagation trace data available
      </div>
    )
  }

  return (
    <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[11px] h-8">Row Key</TableHead>
            <TableHead className="text-[11px] h-8">Explanation Key</TableHead>
            <TableHead className="text-[11px] h-8">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.map((row, idx) => (
            <TableRow key={`${row.rowKeyValue}-${row.explanationKeyCode}-${idx}`}>
              <TableCell className="text-xs font-mono max-w-[120px] truncate py-1.5">
                {row.rowKeyValue}
              </TableCell>
              <TableCell className="py-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 gap-1"
                  style={{
                    borderColor: row.explanationKeyColor || undefined,
                    color: row.explanationKeyColor || undefined,
                    backgroundColor: row.explanationKeyColor
                      ? `${row.explanationKeyColor}15`
                      : undefined,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: row.explanationKeyColor || "#6b7280" }}
                  />
                  {row.explanationKeyLabel}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px] py-1.5">
                {row.parentDefinitionName}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {remaining > 0 && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border text-center">
          and {remaining.toLocaleString()} more...
        </div>
      )}
    </div>
  )
}
