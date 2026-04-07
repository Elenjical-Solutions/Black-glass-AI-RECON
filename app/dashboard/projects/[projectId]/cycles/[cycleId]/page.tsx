"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { getCycleByIdAction, updateCycleStatusAction } from "@/actions/cycles-actions"
import { getRunsWithContextForCycleAction, triggerRunAction } from "@/actions/runs-actions"
import { getDefinitionsForProjectAction } from "@/actions/definitions-actions"
import { getFilesForProjectAction } from "@/actions/files-actions"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  ArrowLeft,
  Play,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  GitBranch
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { RegressionCycle } from "@/db/schema/cycles-schema"
import type { ReconciliationRun } from "@/db/schema/runs-schema"

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed": return "bg-green-500/20 text-green-400 border-green-500/30"
    case "running": case "pending": return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    case "failed": return "bg-red-500/20 text-red-400 border-red-500/30"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-400" />
    case "running": case "pending": case "processing": return <Clock className="h-4 w-4 text-blue-400" />
    case "failed": return <XCircle className="h-4 w-4 text-red-400" />
    default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
  }
}

function categoryBadge(category: string | null) {
  switch (category) {
    case "core": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Core</Badge>
    case "sensitivity": return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">Sensitivity</Badge>
    case "downstream": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Downstream</Badge>
    default: return null
  }
}

type EnrichedRun = ReconciliationRun & {
  definitionName: string
  category: string | null
  department: string | null
  fileAName: string | null
  fileBName: string | null
}

export default function CycleDetailPage({
  params
}: {
  params: Promise<{ projectId: string; cycleId: string }>
}) {
  const { projectId, cycleId } = use(params)
  const [cycle, setCycle] = useState<RegressionCycle | null>(null)
  const [runs, setRuns] = useState<EnrichedRun[]>([])
  const [definitions, setDefinitions] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAll, setRunningAll] = useState(false)

  // Run dialog state
  const [runDialogOpen, setRunDialogOpen] = useState(false)
  const [runDialogDefId, setRunDialogDefId] = useState("")
  const [runDialogFileA, setRunDialogFileA] = useState("")
  const [runDialogFileB, setRunDialogFileB] = useState("")
  const [runDialogSubmitting, setRunDialogSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    const [cycleResult, runsResult, defsResult, filesResult] = await Promise.all([
      getCycleByIdAction(cycleId),
      getRunsWithContextForCycleAction(cycleId),
      getDefinitionsForProjectAction(projectId),
      getFilesForProjectAction(projectId)
    ])
    if (cycleResult.status === "success") setCycle(cycleResult.data)
    if (runsResult.status === "success") setRuns(runsResult.data as EnrichedRun[])
    if (defsResult.status === "success") setDefinitions(defsResult.data)
    if (filesResult.status === "success") setFiles(filesResult.data)
    setLoading(false)
  }, [cycleId, projectId])

  useEffect(() => { loadData() }, [loadData])

  const sourceAFiles = files.filter((f: any) => f.fileRole === "source_a")
  const sourceBFiles = files.filter((f: any) => f.fileRole === "source_b")

  async function handleRunAll() {
    if (definitions.length === 0) { toast.error("No definitions to run"); return }
    setRunningAll(true)
    toast.info(`Running ${definitions.length} definitions...`)
    try {
      await updateCycleStatusAction(cycleId, "running")
      let successCount = 0, failCount = 0
      for (const def of definitions) {
        // Use definition's default files (legacy fallback)
        const result = await triggerRunAction(cycleId, def.id, def.sourceAFileId, def.sourceBFileId)
        if (result.status === "success") successCount++
        else failCount++
      }
      await updateCycleStatusAction(cycleId, "completed")
      if (failCount === 0) toast.success(`All ${successCount} runs completed`)
      else toast.error(`${successCount} succeeded, ${failCount} failed`)
      loadData()
    } catch {
      toast.error("Failed to run definitions")
      await updateCycleStatusAction(cycleId, "failed")
    } finally { setRunningAll(false) }
  }

  function openRunDialog(definitionId?: string) {
    setRunDialogDefId(definitionId ?? "")
    setRunDialogFileA("")
    setRunDialogFileB("")
    setRunDialogOpen(true)
  }

  async function handleRunWithFiles() {
    if (!runDialogDefId || !runDialogFileA || !runDialogFileB) {
      toast.error("Select a definition and both files")
      return
    }
    setRunDialogSubmitting(true)
    const result = await triggerRunAction(cycleId, runDialogDefId, runDialogFileA, runDialogFileB)
    setRunDialogSubmitting(false)
    if (result.status === "success") {
      toast.success("Run completed")
      setRunDialogOpen(false)
      loadData()
    } else {
      toast.error(result.message)
    }
  }

  async function handleRunSingle(definitionId: string) {
    // Quick re-run with same default files
    toast.info("Running reconciliation...")
    const result = await triggerRunAction(cycleId, definitionId)
    if (result.status === "success") { toast.success("Run completed"); loadData() }
    else toast.error(result.message)
  }

  function getSummaryStats(run: ReconciliationRun) {
    const summary = run.summary as any
    if (!summary) return null
    return {
      matched: summary.matched ?? 0,
      breaks: summary.breaks ?? 0,
      explained: summary.explained ?? 0,
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
    return <div className="p-6 lg:p-8"><p className="text-muted-foreground">Cycle not found.</p></div>
  }

  // Group runs by category for display
  const coreRuns = runs.filter(r => r.category === "core")
  const sensiRuns = runs.filter(r => r.category === "sensitivity")
  const downstreamRuns = runs.filter(r => r.category === "downstream")

  // Overall stats
  const totalMatched = runs.reduce((s, r) => s + (getSummaryStats(r)?.matched ?? 0), 0)
  const totalBreaks = runs.reduce((s, r) => s + (getSummaryStats(r)?.breaks ?? 0), 0)
  const totalExplained = runs.reduce((s, r) => s + (getSummaryStats(r)?.explained ?? 0), 0)

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link
        href={`/dashboard/projects/${projectId}/cycles`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cycles
      </Link>

      {/* Cycle Header */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{cycle.name}</h2>
              <Badge className={cn(statusBadgeClass(cycle.status))}>{cycle.status}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              {cycle.startedAt && <span>Started {format(new Date(cycle.startedAt), "MMM d, yyyy HH:mm")}</span>}
              {cycle.completedAt && <span>Completed {format(new Date(cycle.completedAt), "MMM d, yyyy HH:mm")}</span>}
            </div>
            {/* Aggregate stats */}
            {runs.length > 0 && (
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">{runs.length} recons</span>
                <span className="text-green-400 font-medium">{totalMatched.toLocaleString()} matched</span>
                <span className="text-red-400 font-medium">{totalBreaks.toLocaleString()} breaks</span>
                <span className="text-amber-400 font-medium">{totalExplained.toLocaleString()} explained</span>
              </div>
            )}
          </div>
          <Button variant="outline" className="gap-2" onClick={() => openRunDialog()}>
            <FileSpreadsheet className="h-4 w-4" />
            Run with Files
          </Button>
          <Button className="gap-2" onClick={handleRunAll} disabled={runningAll}>
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run All (Default Files)
          </Button>
        </div>
      </Card>

      {/* Runs by Section */}
      {runs.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No runs yet. Click &quot;Run All Definitions&quot; to start.</p>
        </Card>
      ) : (
        <>
          {coreRuns.length > 0 && (
            <RunSection
              title="Core Reconciliation"
              badge={<Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Core</Badge>}
              runs={coreRuns}
              projectId={projectId}
              cycleId={cycleId}
              onRunSingle={handleRunSingle}
              getSummaryStats={getSummaryStats}
            />
          )}
          {sensiRuns.length > 0 && (
            <RunSection
              title="Sensitivity Reconciliations"
              badge={<Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Sensitivity</Badge>}
              runs={sensiRuns}
              projectId={projectId}
              cycleId={cycleId}
              onRunSingle={handleRunSingle}
              getSummaryStats={getSummaryStats}
            />
          )}
          {downstreamRuns.length > 0 && (
            <RunSection
              title="Downstream Reports"
              badge={<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Downstream</Badge>}
              runs={downstreamRuns}
              projectId={projectId}
              cycleId={cycleId}
              onRunSingle={handleRunSingle}
              getSummaryStats={getSummaryStats}
            />
          )}
        </>
      )}

      {/* Run with Files Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Run Reconciliation with Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recon Template</label>
              <Select value={runDialogDefId} onValueChange={(v) => v && setRunDialogDefId(v)}>
                <SelectTrigger><SelectValue placeholder="Select definition..." /></SelectTrigger>
                <SelectContent>
                  {definitions.map((def: any) => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source A File</label>
              <Select value={runDialogFileA} onValueChange={(v) => v && setRunDialogFileA(v)}>
                <SelectTrigger><SelectValue placeholder="Select source A..." /></SelectTrigger>
                <SelectContent>
                  {sourceAFiles.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-3 w-3 text-blue-400" />
                        {f.filename}
                        <span className="text-[10px] text-muted-foreground">({f.rowCount?.toLocaleString()} rows)</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source B File</label>
              <Select value={runDialogFileB} onValueChange={(v) => v && setRunDialogFileB(v)}>
                <SelectTrigger><SelectValue placeholder="Select source B..." /></SelectTrigger>
                <SelectContent>
                  {sourceBFiles.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-3 w-3 text-cyan-400" />
                        {f.filename}
                        <span className="text-[10px] text-muted-foreground">({f.rowCount?.toLocaleString()} rows)</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRunWithFiles} disabled={runDialogSubmitting || !runDialogDefId || !runDialogFileA || !runDialogFileB}>
              {runDialogSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
              Run Reconciliation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RunSection({
  title,
  badge,
  runs,
  projectId,
  cycleId,
  onRunSingle,
  getSummaryStats,
}: {
  title: string
  badge: React.ReactNode
  runs: EnrichedRun[]
  projectId: string
  cycleId: string
  onRunSingle: (defId: string) => void
  getSummaryStats: (run: ReconciliationRun) => { matched: number; breaks: number; explained: number; total: number } | null
}) {
  return (
    <Card className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        {badge}
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground ml-auto">{runs.length} recon(s)</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Reconciliation</TableHead>
            <TableHead>Files Compared</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Matched</TableHead>
            <TableHead className="text-center">Breaks</TableHead>
            <TableHead className="text-center">Explained</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run, index) => {
            const stats = getSummaryStats(run)
            const explainedPct = stats && stats.breaks > 0 ? Math.round((stats.explained / stats.breaks) * 100) : 0
            return (
              <TableRow key={run.id}>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium text-sm">{run.definitionName}</div>
                    {run.department && (
                      <span className="text-[10px] text-muted-foreground">{run.department}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileSpreadsheet className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[120px]" title={run.fileAName ?? ""}>
                      {run.fileAName ?? "—"}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-primary/50" />
                    <span className="truncate max-w-[120px]" title={run.fileBName ?? ""}>
                      {run.fileBName ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {statusIcon(run.status)}
                    <span className="capitalize text-sm">{run.status}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {stats ? <span className="text-green-400 font-medium">{stats.matched.toLocaleString()}</span> : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {stats ? <span className="text-red-400 font-medium">{stats.breaks.toLocaleString()}</span> : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {stats && stats.breaks > 0 ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-amber-400 font-medium">{stats.explained}</span>
                      <div className="w-12 h-1.5 rounded-full bg-red-500/20 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${explainedPct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{explainedPct}%</span>
                    </div>
                  ) : stats ? "—" : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onRunSingle(run.definitionId)} title="Re-run">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    {run.status === "completed" && (
                      <Link href={`/dashboard/projects/${projectId}/cycles/${cycleId}/runs/${run.id}`}>
                        <Button variant="ghost" size="sm" title="View Results">
                          <ArrowRight className="h-3.5 w-3.5" />
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
    </Card>
  )
}
