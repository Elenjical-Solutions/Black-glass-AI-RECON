"use client"

import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, ArrowRight, Sparkles, GitBranch } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DependencySuggestionPanel } from "@/components/ai/dependency-suggestion-panel"
import type { DefinitionWithStats } from "./tree-browser"

interface ExplanationKeySummary {
  explanationKeyCode: string
  explanationKeyLabel: string
  explanationKeyColor: string
  count: number
}

interface UpstreamSource {
  definitionName: string
  definitionId: string
  propagatedCount: number
}

interface ExplanationFlow {
  summary: ExplanationKeySummary[]
  upstreamSources: UpstreamSource[]
}

interface DefinitionSummaryPanelProps {
  definition: DefinitionWithStats | null
  explanationFlow: ExplanationFlow | null
  projectId: string
  cycleId: string | null
  onNavigateToResults: (runId: string) => void
  onEdgeAdded?: () => void
}

const categoryBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  core: { bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400", label: "Core" },
  sensitivity: { bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400", label: "Sensitivity" },
  downstream: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", label: "Downstream" },
}

function extractField(summary: any, ...fields: string[]): number {
  if (!summary) return 0
  const parsed = typeof summary === "string" ? JSON.parse(summary) : summary
  for (const f of fields) {
    if (parsed[f] !== undefined) return parsed[f]
  }
  return 0
}

export function DefinitionSummaryPanel({
  definition,
  explanationFlow,
  projectId,
  cycleId,
  onNavigateToResults,
  onEdgeAdded,
}: DefinitionSummaryPanelProps) {
  if (!definition) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6">
        <div className="text-center space-y-2">
          <div className="text-2xl opacity-30">{"\u2630"}</div>
          <p>Select a definition to view details</p>
        </div>
      </div>
    )
  }

  const category = definition.category ?? "core"
  const catStyle = categoryBadgeStyles[category] ?? categoryBadgeStyles.core
  const matched = extractField(definition.runSummary, "matched", "totalMatched")
  const breaks = extractField(definition.runSummary, "breaks", "totalBreaks")
  const explained = extractField(definition.runSummary, "explained", "totalExplained")
  const unexplained = breaks - explained
  const hasRun = !!definition.runId

  return (
    <div className="h-full overflow-y-auto space-y-4 p-4">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground leading-tight">
          {definition.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 h-5", catStyle.bg, catStyle.text)}
          >
            {catStyle.label}
          </Badge>
          {definition.department && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {definition.department}
            </Badge>
          )}
          {hasRun && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-5",
                breaks > 0
                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                  : "bg-green-500/15 text-green-400 border-green-500/30"
              )}
            >
              {breaks > 0 ? "Has Breaks" : "All Matched"}
            </Badge>
          )}
        </div>
        {definition.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {definition.description}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      {hasRun && (
        <div className="grid grid-cols-2 gap-2">
          <StatBox
            label="Matched"
            value={matched}
            icon={CheckCircle2}
            color="text-green-400"
            bg="bg-green-500/10"
          />
          <StatBox
            label="Breaks"
            value={breaks}
            icon={XCircle}
            color="text-red-400"
            bg="bg-red-500/10"
          />
          <StatBox
            label="Explained"
            value={explained}
            icon={AlertTriangle}
            color="text-amber-400"
            bg="bg-amber-500/10"
          />
          <StatBox
            label="Unexplained"
            value={unexplained}
            icon={HelpCircle}
            color="text-orange-400"
            bg="bg-orange-500/10"
          />
        </div>
      )}

      {/* Explanation Key Breakdown */}
      {explanationFlow && explanationFlow.summary.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Explanation Breakdown
          </h4>
          <div className="space-y-1">
            {[...explanationFlow.summary]
              .sort((a, b) => b.count - a.count)
              .map((item) => (
                <div
                  key={item.explanationKeyCode}
                  className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/30"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.explanationKeyColor || "#6b7280" }}
                  />
                  <span className="text-xs text-foreground flex-1 truncate">
                    {item.explanationKeyLabel}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Upstream Sources */}
      {explanationFlow &&
        explanationFlow.upstreamSources.length > 0 &&
        (category === "sensitivity" || category === "downstream") && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              Explained by Upstream
            </h4>
            <div className="space-y-1">
              {explanationFlow.upstreamSources.map((source) => (
                <div
                  key={source.definitionId}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/30"
                >
                  <ArrowRight className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">
                    {source.definitionName}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {source.propagatedCount.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* AI Dependency Suggestions for downstream */}
      {category === "downstream" && (
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            AI Dependencies
          </h4>
          <DependencySuggestionPanel
            definitionId={definition.id}
            projectId={projectId}
            onEdgeAdded={onEdgeAdded ?? (() => {})}
          />
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-border space-y-2">
        {hasRun ? (
          <>
            <Button
              className="w-full justify-center gap-2 text-xs"
              size="sm"
              onClick={() => onNavigateToResults(definition.runId!)}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              View Results
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-2 text-xs"
              size="sm"
              disabled
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Summary
            </Button>
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">No reconciliation run yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}) {
  return (
    <div className={cn("rounded-lg p-2.5 space-y-1", bg)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3 w-3", color)} />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={cn("text-lg font-bold tabular-nums", color)}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
