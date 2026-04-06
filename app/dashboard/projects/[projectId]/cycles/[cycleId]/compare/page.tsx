"use client"

import { useState, useEffect, useCallback, use } from "react"
import { getCycleByIdAction, getCyclesForProjectAction } from "@/actions/cycles-actions"
import { getRunsForCycleAction } from "@/actions/runs-actions"
import { getDefinitionsForProjectAction } from "@/actions/definitions-actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SummaryStatsCard } from "@/components/recon/summary-stats-card"
import { StatusBadge } from "@/components/recon/status-badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Loader2,
  GitCompareArrows,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { RegressionCycle } from "@/db/schema/cycles-schema"
import type { ReconciliationRun } from "@/db/schema/runs-schema"
import type { ReconciliationDefinition } from "@/db/schema/definitions-schema"

interface CycleStats {
  totalMatches: number
  totalBreaks: number
  totalExplained: number
  totalRows: number
}

interface DefinitionComparison {
  definitionId: string
  name: string
  cycleAMatches: number
  cycleABreaks: number
  cycleAExplained: number
  cycleBMatches: number
  cycleBBreaks: number
  cycleBExplained: number
  breakDiff: number
  trend: "improved" | "regressed" | "unchanged"
}

function extractStats(runs: ReconciliationRun[]): CycleStats {
  let totalMatches = 0
  let totalBreaks = 0
  let totalExplained = 0
  let totalRows = 0

  for (const run of runs) {
    const summary = run.summary as Record<string, number> | null
    if (summary) {
      totalMatches += summary.matches ?? summary.matched ?? 0
      totalBreaks += summary.breaks ?? 0
      totalExplained += summary.explained ?? 0
      totalRows += summary.totalRows ?? summary.total ?? 0
    }
  }

  return { totalMatches, totalBreaks, totalExplained, totalRows }
}

export default function CycleComparePage({
  params
}: {
  params: Promise<{ projectId: string; cycleId: string }>
}) {
  const { projectId, cycleId } = use(params)

  const [cycleA, setCycleA] = useState<RegressionCycle | null>(null)
  const [cycleB, setCycleB] = useState<RegressionCycle | null>(null)
  const [allCycles, setAllCycles] = useState<RegressionCycle[]>([])
  const [compareCycleId, setCompareCycleId] = useState("")
  const [runsA, setRunsA] = useState<ReconciliationRun[]>([])
  const [runsB, setRunsB] = useState<ReconciliationRun[]>([])
  const [definitions, setDefinitions] = useState<ReconciliationDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingB, setLoadingB] = useState(false)

  const loadInitialData = useCallback(async () => {
    const [cycleResult, cyclesResult, runsResult, defsResult] =
      await Promise.all([
        getCycleByIdAction(cycleId),
        getCyclesForProjectAction(projectId),
        getRunsForCycleAction(cycleId),
        getDefinitionsForProjectAction(projectId)
      ])

    if (cycleResult.status === "success") setCycleA(cycleResult.data)
    if (cyclesResult.status === "success") {
      setAllCycles(
        cyclesResult.data.filter(c => c.id !== cycleId)
      )
    }
    if (runsResult.status === "success") setRunsA(runsResult.data)
    if (defsResult.status === "success") setDefinitions(defsResult.data)

    setLoading(false)
  }, [cycleId, projectId])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const loadCycleB = useCallback(
    async (selectedCycleId: string) => {
      setLoadingB(true)
      setCompareCycleId(selectedCycleId)

      const [cycleResult, runsResult] = await Promise.all([
        getCycleByIdAction(selectedCycleId),
        getRunsForCycleAction(selectedCycleId)
      ])

      if (cycleResult.status === "success") setCycleB(cycleResult.data)
      if (runsResult.status === "success") setRunsB(runsResult.data)

      setLoadingB(false)
    },
    []
  )

  const statsA = extractStats(runsA)
  const statsB = extractStats(runsB)

  // Build per-definition comparison
  const comparisons: DefinitionComparison[] = definitions
    .map(def => {
      const runA = runsA.find(r => r.definitionId === def.id)
      const runB = runsB.find(r => r.definitionId === def.id)

      const summaryA = (runA?.summary as Record<string, number> | null) ?? {}
      const summaryB = (runB?.summary as Record<string, number> | null) ?? {}

      const aBreaks = summaryA.breaks ?? 0
      const bBreaks = summaryB.breaks ?? 0
      const breakDiff = bBreaks - aBreaks

      let trend: DefinitionComparison["trend"] = "unchanged"
      if (breakDiff < 0) trend = "improved"
      else if (breakDiff > 0) trend = "regressed"

      return {
        definitionId: def.id,
        name: def.name,
        cycleAMatches: summaryA.matches ?? summaryA.matched ?? 0,
        cycleABreaks: aBreaks,
        cycleAExplained: summaryA.explained ?? 0,
        cycleBMatches: summaryB.matches ?? summaryB.matched ?? 0,
        cycleBBreaks: bBreaks,
        cycleBExplained: summaryB.explained ?? 0,
        breakDiff,
        trend
      }
    })
    .filter(c => {
      const hasA = runsA.some(r => r.definitionId === c.definitionId)
      const hasB = runsB.some(r => r.definitionId === c.definitionId)
      return hasA || hasB
    })

  const improved = comparisons.filter(c => c.trend === "improved").length
  const regressed = comparisons.filter(c => c.trend === "regressed").length
  const unchanged = comparisons.filter(c => c.trend === "unchanged").length

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="glass-card rounded-xl flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/projects/${projectId}/cycles/${cycleId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Cycle
          </Link>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Cross-Cycle Comparison</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Compare {cycleA?.name ?? "Current cycle"} against another cycle to
          identify regressions and improvements.
        </p>
      </div>

      {/* Cycle selector */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Cycle A (Current)
            </label>
            <div className="glass-subtle rounded-lg px-3 py-2 text-sm font-medium">
              {cycleA?.name ?? "Loading..."}
            </div>
          </div>

          <div className="flex items-center pt-5">
            <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Cycle B (Compare Against)
            </label>
            <Select
              value={compareCycleId}
              onValueChange={(v) => v && loadCycleB(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a cycle to compare..." />
              </SelectTrigger>
              <SelectContent>
                {allCycles.map(cycle => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading state for Cycle B */}
      {loadingB && (
        <div className="glass-card rounded-xl flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">
            Loading comparison data...
          </span>
        </div>
      )}

      {/* Stats comparison */}
      {cycleB && !loadingB && (
        <>
          <div className="grid grid-cols-2 gap-6">
            {/* Cycle A stats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {cycleA?.name}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <SummaryStatsCard
                  title="Total Rows"
                  value={statsA.totalRows}
                  icon={BarChart3}
                  variant="info"
                />
                <SummaryStatsCard
                  title="Matches"
                  value={statsA.totalMatches}
                  icon={CheckCircle2}
                  variant="success"
                />
                <SummaryStatsCard
                  title="Breaks"
                  value={statsA.totalBreaks}
                  icon={XCircle}
                  variant="danger"
                />
                <SummaryStatsCard
                  title="Explained"
                  value={statsA.totalExplained}
                  icon={AlertTriangle}
                  variant="warning"
                />
              </div>
            </div>

            {/* Cycle B stats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {cycleB.name}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <SummaryStatsCard
                  title="Total Rows"
                  value={statsB.totalRows}
                  icon={BarChart3}
                  variant="info"
                />
                <SummaryStatsCard
                  title="Matches"
                  value={statsB.totalMatches}
                  icon={CheckCircle2}
                  variant="success"
                />
                <SummaryStatsCard
                  title="Breaks"
                  value={statsB.totalBreaks}
                  icon={XCircle}
                  variant="danger"
                />
                <SummaryStatsCard
                  title="Explained"
                  value={statsB.totalExplained}
                  icon={AlertTriangle}
                  variant="warning"
                />
              </div>
            </div>
          </div>

          {/* Trend summary */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm">
                  <span className="font-semibold text-green-400">
                    {improved}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    definition{improved !== 1 ? "s" : ""} improved
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-sm">
                  <span className="font-semibold text-red-400">
                    {regressed}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    regressed
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{unchanged}</span>{" "}
                  <span className="text-muted-foreground">unchanged</span>
                </span>
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Definition
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Matches (A / B)
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Breaks (A / B)
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Explained (A / B)
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Break Diff
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(comp => (
                    <tr
                      key={comp.definitionId}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {comp.name}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        <span className="text-muted-foreground">
                          {comp.cycleAMatches}
                        </span>
                        <span className="text-muted-foreground/50 mx-1.5">
                          /
                        </span>
                        <span className="text-muted-foreground">
                          {comp.cycleBMatches}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        <span
                          className={cn(
                            comp.cycleABreaks > 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {comp.cycleABreaks}
                        </span>
                        <span className="text-muted-foreground/50 mx-1.5">
                          /
                        </span>
                        <span
                          className={cn(
                            comp.cycleBBreaks > 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {comp.cycleBBreaks}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        <span className="text-muted-foreground">
                          {comp.cycleAExplained}
                        </span>
                        <span className="text-muted-foreground/50 mx-1.5">
                          /
                        </span>
                        <span className="text-muted-foreground">
                          {comp.cycleBExplained}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold",
                            comp.breakDiff < 0 && "text-green-400",
                            comp.breakDiff > 0 && "text-red-400",
                            comp.breakDiff === 0 && "text-muted-foreground"
                          )}
                        >
                          {comp.breakDiff > 0
                            ? `+${comp.breakDiff}`
                            : comp.breakDiff}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {comp.trend === "improved" && (
                          <Badge
                            variant="outline"
                            className="bg-green-500/15 text-green-400 border-green-500/30 gap-1"
                          >
                            <TrendingUp className="h-3 w-3" />
                            Improved
                          </Badge>
                        )}
                        {comp.trend === "regressed" && (
                          <Badge
                            variant="outline"
                            className="bg-red-500/15 text-red-400 border-red-500/30 gap-1"
                          >
                            <TrendingDown className="h-3 w-3" />
                            Regressed
                          </Badge>
                        )}
                        {comp.trend === "unchanged" && (
                          <Badge
                            variant="outline"
                            className="bg-muted/30 text-muted-foreground border-border/50 gap-1"
                          >
                            <Minus className="h-3 w-3" />
                            Unchanged
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}

                  {comparisons.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No definitions with runs found in both cycles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state when no comparison cycle is selected */}
      {!cycleB && !loadingB && (
        <Card className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <GitCompareArrows className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Select a Cycle to Compare</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Choose another cycle from the dropdown above to see a side-by-side
            comparison of reconciliation results and identify regressions or
            improvements.
          </p>
        </Card>
      )}
    </div>
  )
}
