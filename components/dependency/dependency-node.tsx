"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

export interface DependencyNodeData {
  label: string
  description?: string | null
  status: "match" | "break" | "none"
  fileAName?: string
  fileBName?: string
  [key: string]: unknown
}

function DependencyNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as DependencyNodeData

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

  return (
    <div
      style={{
        background: "oklch(0.18 0.02 250 / 0.8)",
        border: "1px solid oklch(0.35 0.03 220 / 0.5)",
        borderRadius: "8px",
        padding: "12px",
        color: "white",
        minWidth: "180px",
        maxWidth: "240px"
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "oklch(0.7 0.15 220)",
          border: "2px solid oklch(0.35 0.03 220 / 0.5)",
          width: 10,
          height: 10
        }}
      />

      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor} ${statusGlow}`}
        />
        <p className="text-sm font-semibold truncate leading-tight">
          {nodeData.label}
        </p>
      </div>

      {nodeData.description && (
        <p className="text-[11px] text-gray-400 mb-2 line-clamp-2 leading-relaxed">
          {nodeData.description}
        </p>
      )}

      <div className="space-y-1 mt-2 pt-2 border-t border-white/10">
        {nodeData.fileAName && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-cyan-400/70 uppercase tracking-wider">
              A
            </span>
            <span className="text-[11px] text-gray-300 truncate">
              {nodeData.fileAName}
            </span>
          </div>
        )}
        {nodeData.fileBName && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-cyan-400/70 uppercase tracking-wider">
              B
            </span>
            <span className="text-[11px] text-gray-300 truncate">
              {nodeData.fileBName}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "oklch(0.7 0.15 220)",
          border: "2px solid oklch(0.35 0.03 220 / 0.5)",
          width: 10,
          height: 10
        }}
      />
    </div>
  )
}

export const DependencyNode = memo(DependencyNodeComponent)
