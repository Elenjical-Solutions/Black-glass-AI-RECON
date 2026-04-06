"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

export interface EnhancedNodeData {
  label: string
  description?: string | null
  category: string | null
  department: string | null
  status: "match" | "break" | "none"
  matched?: number
  breaks?: number
  explained?: number
  isSelected?: boolean
  [key: string]: unknown
}

const categoryBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  core: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Core" },
  sensitivity: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Sensitivity" },
  downstream: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Downstream" },
}

function EnhancedDependencyNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as EnhancedNodeData

  const statusColor =
    nodeData.status === "match"
      ? "bg-green-400"
      : nodeData.status === "break"
        ? "bg-red-400"
        : "bg-gray-500"

  const statusGlow =
    nodeData.status === "match"
      ? "shadow-[0_0_6px_rgba(74,222,128,0.4)]"
      : nodeData.status === "break"
        ? "shadow-[0_0_6px_rgba(248,113,113,0.4)]"
        : ""

  const category = nodeData.category ?? "core"
  const catStyle = categoryBadgeStyles[category] ?? categoryBadgeStyles.core

  const breaks = nodeData.breaks ?? 0
  const explained = nodeData.explained ?? 0
  const explainedPct = breaks > 0 ? Math.round((explained / breaks) * 100) : 0
  const hasStats = nodeData.matched !== undefined || breaks > 0

  return (
    <div
      className={cn(
        "transition-all duration-200",
        nodeData.isSelected && "scale-[1.03]"
      )}
      style={{
        background: "oklch(0.18 0.02 250 / 0.85)",
        border: nodeData.isSelected
          ? "2px solid oklch(0.7 0.15 220)"
          : "1px solid oklch(0.35 0.03 220 / 0.5)",
        borderRadius: "10px",
        padding: "10px 12px",
        color: "white",
        width: "280px",
        boxShadow: nodeData.isSelected
          ? "0 0 16px oklch(0.7 0.15 220 / 0.3), 0 0 4px oklch(0.7 0.15 220 / 0.15)"
          : "0 2px 8px oklch(0 0 0 / 0.3)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "oklch(0.7 0.15 220)",
          border: "2px solid oklch(0.35 0.03 220 / 0.5)",
          width: 10,
          height: 10,
        }}
      />

      {/* Category + Department badges */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            catStyle.bg,
            catStyle.text
          )}
        >
          {catStyle.label}
        </span>
        {nodeData.department && (category === "sensitivity" || category === "downstream") && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium text-gray-400 bg-white/5 border border-white/10">
            {nodeData.department}
          </span>
        )}
      </div>

      {/* Status dot + label */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusColor, statusGlow)}
        />
        <p className="text-sm font-semibold truncate leading-tight">
          {nodeData.label}
        </p>
      </div>

      {/* Description */}
      {nodeData.description && (
        <p className="text-[10px] text-gray-400 mb-2 line-clamp-1 leading-relaxed">
          {nodeData.description}
        </p>
      )}

      {/* Stats row */}
      {hasStats && (
        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/10 text-[10px]">
          {nodeData.matched !== undefined && (
            <span className="flex items-center gap-0.5 text-green-400">
              {(nodeData.matched ?? 0).toLocaleString()}
              <span className="text-[9px]">{"\u2713"}</span>
            </span>
          )}
          {breaks > 0 && (
            <>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-0.5 text-red-400">
                {breaks.toLocaleString()}
                <span className="text-[9px]">{"\u2717"}</span>
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-0.5 text-amber-400">
                {explained.toLocaleString()}
                <span className="text-[9px]">{"\u25C9"}</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Progress bar */}
      {breaks > 0 && (
        <div className="mt-1.5 w-full h-1 rounded-full bg-red-500/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-green-400 transition-all"
            style={{ width: `${explainedPct}%` }}
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "oklch(0.7 0.15 220)",
          border: "2px solid oklch(0.35 0.03 220 / 0.5)",
          width: 10,
          height: 10,
        }}
      />
    </div>
  )
}

export const EnhancedDependencyNode = memo(EnhancedDependencyNodeComponent)
