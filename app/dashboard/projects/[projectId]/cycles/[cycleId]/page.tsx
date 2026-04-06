"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { getCycleByIdAction, updateCycleStatusAction } from "@/actions/cycles-actions"
import { getRunsForCycleAction, triggerRunAction } from "@/actions/runs-actions"
import { getDefinitionsForProjectAction } from "@/actions/definitions-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  ArrowLeft,
  Play,
  GitBranch,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { RegressionCycle } from "@/db/schema/cycles-schema"
import type { ReconciliationRun } from "@/db/schema/runs-schema"
import type { ReconciliationDefinition } from "@/db/schema/definitions-schema"

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "running":
    case "pending":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    case "failed":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-400" />
    case "running":
    case "pending":
      return <Clock className="h-4 w-4 text-blue-400" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
  }
}

export default function CycleDetailPage({
  params
}: {
  params: Promise<{ projectId: string; cycleId: string }>
}) {
  const { projectId, cycleId } = use(params)
  const [cycle, setCycle] = useState<RegressionCycle | null>(null)
  const [runs, setRuns] = useState<ReconciliationRun[]>([])
  const [definitions, setDefinitions] = useState<ReconciliationDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAll, setRunningAll] = useState(false)

  const loadData = useCallback(async () => {
    const [cycleResult, runsResult, defsResult] = await Promise.all([
      getCycleByIdAction(cycleId),
      getRunsForCycleAction(cycleId),
      getDefinitionsForProjectAction(projectId)
    ])

    if (cycleResult.status === "success") setCycle(cycleResult.data)
    if (runsResult.status === "success") setRuns(runsResult.data)
    if (defsResult.status === "success") setDefinitions(defsResult.data)
    setLoading(false)
  }, [cycleId, projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const defNameMap = new Map(definitions.map(d => [d.id, d.name]))

  async function handleRunAll() {
    if (definitions.length === 0) {
      toast.error("No definitions to run")
      return
    }

    setRunningAll(true)
    toast.info(`Running ${definitions.length} definitions...`)

    try {
      // Update cycle status to running
      await updateCycleStatusAction(cycleId, "running")

      let successCount = 0
      let failCount = 0

      for (const def of definitions) {
        const result = await triggerRunAction(cycleId, def.id)
        if (result.status === "success") {
          successCount++
        } else {
          failCount++
        }
      }

      // Update cycle status to completed
      await updateCycleStatusAction(cycleId, "completed")

      if (failCount === 0) {
        toast.success(`All ${successCount} runs completed successfully`)
      } else {
        toast.error(
          `${successCount} succeeded, ${failCount} failed`
        )
      }

      loadData()
    } catch {
      toast.error("Failed to run definitions")
      await updateCycleStatusAction(cycleId, "failed")
    } finally {
      setRunningAll(false)
    }
  }

  async function handleRunSingle(definitionId: string) {
    toast.info("Running reconciliation...")
    const result = await triggerRunAction(cycleId, definitionId)
    if (result.status === "success") {
      toast.success("Run completed")
      loadData()
    } else {
      toast.error(result.message)
    }
  }

  function getSummaryStats(run: ReconciliationRun) {
    const summary = run.summary as any
    if (!summary) return null
    return {
      matched: summary.matched ?? 0,
      breaks: summary.breaks ?? 0,
      explained: summary.explained ?? 0,
      missingA: summary.missingA ?? summary.missing_a ?? 0,
      missingB: summary.missingB ?? summary.missing_b ?? 0,
      total: summary.totalRows ?? summary.total ?? 0
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Cycle not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link
        href={`/dashboard/projects/${projectId}/cycles`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cycles
      </Link>

      {/* Cycle Info */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{cycle.name}</h2>
              <Badge className={cn(statusBadgeClass(cycle.status))}>
                {cycle.status}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              {cycle.startedAt && (
                <span>
                  Started{" "}
                  {format(new Date(cycle.startedAt), "MMM d, yyyy HH:mm")}
                </span>
              )}
              {cycle.completedAt && (
                <span>
                  Completed{" "}
                  {format(new Date(cycle.completedAt), "MMM d, yyyy HH:mm")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="gap-2"
              onClick={handleRunAll}
              disabled={runningAll}
            >
              {runningAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run All Definitions
            </Button>
          </div>
        </div>
      </Card>

      {/* Runs Table */}
      <Card className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-lg font-semibold">
            Runs ({runs.length})
          </h3>
        </div>

        {runs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No runs yet. Click &quot;Run All Definitions&quot; to start
              reconciliation.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Definition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Matched</TableHead>
                <TableHead className="text-center">Breaks</TableHead>
                <TableHead className="text-center">Explained</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => {
                const stats = getSummaryStats(run)
                return (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {defNameMap.get(run.definitionId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(run.status)}
                        <span className="capitalize">{run.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {stats ? (
                        <span className="text-green-400 font-medium">
                          {stats.matched}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stats ? (
                        <span className="text-red-400 font-medium">
                          {stats.breaks}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stats ? (
                        <span className="text-amber-400 font-medium">
                          {stats.explained}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {run.startedAt
                        ? format(new Date(run.startedAt), "HH:mm:ss")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRunSingle(run.definitionId)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        {run.status === "completed" && (
                          <Link
                            href={`/dashboard/projects/${projectId}/cycles/${cycleId}/runs/${run.id}`}
                          >
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
