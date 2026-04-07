"use client"

import { useState, useEffect, useCallback, use, Fragment } from "react"
import { getRunByIdAction, getRunWithContextAction } from "@/actions/runs-actions"
import {
  getResultsAction,
  getResultDetailsAction,
  assignExplanationKeyAction,
  bulkAssignExplanationKeyAction
} from "@/actions/results-actions"
import { getExplanationKeysAction } from "@/actions/explanation-keys-actions"
import { explainDifferencesAction, generateSummaryAction, aiAssignByNaturalLanguageRulesAction } from "@/actions/ai-actions"
import { BreakAnalysisPanel } from "@/components/ai/break-analysis-panel"
import { KeySuggestionInline } from "@/components/ai/key-suggestion-inline"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  Search,
  FileText,
  FileSpreadsheet,
  Tag
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { ReconciliationRun } from "@/db/schema/runs-schema"
import type { ReconciliationResult } from "@/db/schema/results-schema"
import type { ExplanationKey } from "@/db/schema/explanation-keys-schema"
import type { ResultFieldDetail } from "@/db/schema/result-field-details-schema"

function statusBadge(status: string) {
  switch (status) {
    case "match":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          Match
        </Badge>
      )
    case "break":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          Break
        </Badge>
      )
    case "missing_a":
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          Missing A
        </Badge>
      )
    case "missing_b":
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
          Missing B
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function RunResultsPage({
  params
}: {
  params: Promise<{ projectId: string; cycleId: string; runId: string }>
}) {
  const { projectId, cycleId, runId } = use(params)

  const [run, setRun] = useState<ReconciliationRun | null>(null)
  const [context, setContext] = useState<{
    definition: { id: string; name: string; description: string | null; category: string | null; department: string | null }
    fileA: { id: string; filename: string; rowCount: number | null } | null
    fileB: { id: string; filename: string; rowCount: number | null } | null
    fieldMappingNames: Record<string, string>
  } | null>(null)
  const [results, setResults] = useState<
    (ReconciliationResult & { explanationKey?: ExplanationKey | null })[]
  >([])
  const [total, setTotal] = useState(0)
  const [explanationKeys, setExplanationKeys] = useState<ExplanationKey[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filters
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterKeyId, setFilterKeyId] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [rowDetails, setRowDetails] = useState<
    Map<string, ResultFieldDetail[]>
  >(new Map())
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set())

  // Bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [bulkKeyId, setBulkKeyId] = useState("")

  // AI panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiExplanation, setAiExplanation] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [nlrAssigning, setNlrAssigning] = useState(false)

  async function handleNLRAssign() {
    setNlrAssigning(true)
    try {
      const result = await aiAssignByNaturalLanguageRulesAction(runId)
      if (result.status === "success") {
        toast.success(
          `AI assigned ${result.data.totalAssigned} keys to ${result.data.assignments.length} breaks using natural language rules`
        )
        loadResults()
        loadRun()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("AI rule assignment failed")
    } finally {
      setNlrAssigning(false)
    }
  }

  const loadRun = useCallback(async () => {
    const [runResult, ctxResult] = await Promise.all([
      getRunByIdAction(runId),
      getRunWithContextAction(runId)
    ])
    if (runResult.status === "success") setRun(runResult.data)
    if (ctxResult.status === "success") {
      setContext({
        definition: ctxResult.data.definition,
        fileA: ctxResult.data.fileA,
        fileB: ctxResult.data.fileB,
        fieldMappingNames: ctxResult.data.fieldMappingNames,
      })
    }
  }, [runId])

  const loadKeys = useCallback(async () => {
    const result = await getExplanationKeysAction(projectId)
    if (result.status === "success") setExplanationKeys(result.data)
  }, [projectId])

  const loadResults = useCallback(async () => {
    const filters: any = {}
    if (filterStatus !== "all") filters.status = filterStatus
    if (filterKeyId !== "all") filters.explanationKeyId = filterKeyId
    if (searchTerm.trim()) filters.search = searchTerm.trim()

    const result = await getResultsAction(runId, filters, page, 50)
    if (result.status === "success") {
      setResults(result.data.results)
      setTotal(result.data.total)
    }
    setLoading(false)
  }, [runId, filterStatus, filterKeyId, searchTerm, page])

  useEffect(() => {
    loadRun()
    loadKeys()
  }, [loadRun, loadKeys])

  useEffect(() => {
    setLoading(true)
    loadResults()
  }, [loadResults])

  async function toggleExpand(resultId: string) {
    const newExpanded = new Set(expandedRows)

    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
      setExpandedRows(newExpanded)
      return
    }

    newExpanded.add(resultId)
    setExpandedRows(newExpanded)

    // Load field details if not cached
    if (!rowDetails.has(resultId)) {
      setLoadingDetails(prev => new Set(prev).add(resultId))
      const result = await getResultDetailsAction(resultId)
      if (result.status === "success") {
        setRowDetails(prev =>
          new Map(prev).set(resultId, result.data.fieldDetails)
        )
      }
      setLoadingDetails(prev => {
        const next = new Set(prev)
        next.delete(resultId)
        return next
      })
    }
  }

  function toggleSelect(resultId: string) {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId)
    } else {
      newSelected.add(resultId)
    }
    setSelectedRows(newSelected)
  }

  function toggleSelectAll() {
    if (selectedRows.size === results.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(results.map(r => r.id)))
    }
  }

  async function handleAssignKey(
    resultId: string,
    explanationKeyId: string | null
  ) {
    const result = await assignExplanationKeyAction(resultId, explanationKeyId)
    if (result.status === "success") {
      toast.success("Explanation key assigned")
      loadResults()
    } else {
      toast.error(result.message)
    }
  }

  async function handleBulkAssign() {
    if (!bulkKeyId || selectedRows.size === 0) return

    const result = await bulkAssignExplanationKeyAction(
      Array.from(selectedRows),
      bulkKeyId
    )
    if (result.status === "success") {
      toast.success(
        `Assigned key to ${selectedRows.size} rows`
      )
      setSelectedRows(new Set())
      setBulkKeyId("")
      loadResults()
    } else {
      toast.error(result.message)
    }
  }

  async function handleExplainSelected() {
    setAiLoading(true)
    setAiExplanation("")

    // Gather break data from selected rows
    const selectedResults = results.filter(r => selectedRows.has(r.id))
    const breaks = selectedResults.map(r => ({
      rowKey: r.rowKeyValue,
      fieldName: "composite",
      valueA: `Row ${r.sourceARowIndex ?? "?"}`,
      valueB: `Row ${r.sourceBRowIndex ?? "?"}`,
      numericDiff: undefined
    }))

    try {
      const result = await explainDifferencesAction(breaks)
      if (result.status === "success") {
        const explanations = result.data
          .map(
            e =>
              `**${e.rowKey}**: ${e.explanation} (Confidence: ${e.confidence})`
          )
          .join("\n\n")
        setAiExplanation(explanations)
      } else {
        setAiExplanation("Failed to generate explanations: " + result.message)
      }
    } catch {
      setAiExplanation("AI explanation failed")
    } finally {
      setAiLoading(false)
    }
  }

  async function handleGenerateSummary() {
    if (!run?.summary) return

    setAiSummaryLoading(true)
    setAiSummary("")

    const summary = run.summary as any

    try {
      const result = await generateSummaryAction({
        totalRows: summary.totalRows ?? total,
        matched: summary.matched ?? 0,
        breaks: summary.breaks ?? 0,
        explained: summary.explained ?? 0,
        unexplained: (summary.breaks ?? 0) - (summary.explained ?? 0),
        topCategories: [],
        topExplanationKeys: []
      })

      if (result.status === "success") {
        setAiSummary(result.data)
      } else {
        setAiSummary("Failed to generate summary: " + result.message)
      }
    } catch {
      setAiSummary("AI summary generation failed")
    } finally {
      setAiSummaryLoading(false)
    }
  }

  const summary = run?.summary as any
  const totalRows = summary?.totalRows ?? total
  const matched = summary?.matched ?? 0
  const breaks = summary?.breaks ?? 0
  const explained = summary?.explained ?? 0
  const unexplained = breaks - explained
  const totalPages = Math.ceil(total / 50)

  if (loading && !run) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link
        href={`/dashboard/projects/${projectId}/cycles/${cycleId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cycle
      </Link>

      {/* Recon Context Header */}
      {context && (
        <Card className="glass-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{context.definition.name}</h2>
                {context.definition.category === "core" && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Core</Badge>
                )}
                {context.definition.category === "sensitivity" && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">Sensitivity</Badge>
                )}
                {context.definition.category === "downstream" && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Downstream</Badge>
                )}
                {context.definition.department && (
                  <Badge variant="outline" className="text-[10px]">{context.definition.department}</Badge>
                )}
              </div>
              {context.definition.description && (
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{context.definition.description}</p>
              )}
            </div>
          </div>
          {/* Files compared */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-400" />
              <div>
                <span className="text-xs text-muted-foreground">Source A: </span>
                <span className="text-xs font-medium">{context.fileA?.filename ?? "—"}</span>
                {context.fileA?.rowCount && (
                  <span className="text-[10px] text-muted-foreground ml-1">({context.fileA.rowCount.toLocaleString()} rows)</span>
                )}
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-primary/50" />
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
              <div>
                <span className="text-xs text-muted-foreground">Source B: </span>
                <span className="text-xs font-medium">{context.fileB?.filename ?? "—"}</span>
                {context.fileB?.rowCount && (
                  <span className="text-[10px] text-muted-foreground ml-1">({context.fileB.rowCount.toLocaleString()} rows)</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="glass-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Total Rows
          </p>
          <p className="text-3xl font-bold mt-1">{totalRows}</p>
        </Card>
        <Card className="glass-card p-4 border-green-500/20">
          <p className="text-xs text-green-400 uppercase tracking-wider">
            Matched
          </p>
          <p className="text-3xl font-bold mt-1 text-green-400">{matched}</p>
        </Card>
        <Card className="glass-card p-4 border-red-500/20">
          <p className="text-xs text-red-400 uppercase tracking-wider">
            Breaks
          </p>
          <p className="text-3xl font-bold mt-1 text-red-400">{breaks}</p>
        </Card>
        <Card className="glass-card p-4 border-amber-500/20">
          <p className="text-xs text-amber-400 uppercase tracking-wider">
            Explained
          </p>
          <p className="text-3xl font-bold mt-1 text-amber-400">{explained}</p>
        </Card>
        <Card className="glass-card p-4 border-orange-500/20">
          <p className="text-xs text-orange-400 uppercase tracking-wider">
            Unexplained
          </p>
          <p className="text-3xl font-bold mt-1 text-orange-400">
            {unexplained > 0 ? unexplained : 0}
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by row key..."
              className="w-64"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <Select
            value={filterStatus}
            onValueChange={(v: string | null) => {
              setFilterStatus(v ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="match">Match</SelectItem>
              <SelectItem value="break">Break</SelectItem>
              <SelectItem value="missing_a">Missing A</SelectItem>
              <SelectItem value="missing_b">Missing B</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterKeyId}
            onValueChange={(v: string | null) => {
              setFilterKeyId(v ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Explanation Keys" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Keys</SelectItem>
              {explanationKeys.map(k => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleNLRAssign}
              disabled={nlrAssigning}
            >
              {nlrAssigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI Assign by Rules
            </Button>
            <BreakAnalysisPanel
              runId={runId}
              projectId={projectId}
              onApplied={() => loadResults()}
            />
            <Sheet open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
              <SheetTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                  <Sparkles className="h-4 w-4" />
                  AI Insights
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Insights
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Explain Selected */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">
                      Explain Selected Breaks
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Select rows in the table, then click below to get AI
                      explanations.
                    </p>
                    <Button
                      className="gap-2 w-full"
                      onClick={handleExplainSelected}
                      disabled={aiLoading || selectedRows.size === 0}
                    >
                      {aiLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Explain {selectedRows.size} Selected
                    </Button>
                    {aiExplanation && (
                      <Card className="p-4 bg-muted/50 text-sm whitespace-pre-wrap">
                        {aiExplanation}
                      </Card>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Generate Summary */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Run Summary</h4>
                    <Button
                      variant="outline"
                      className="gap-2 w-full"
                      onClick={handleGenerateSummary}
                      disabled={aiSummaryLoading}
                    >
                      {aiSummaryLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Generate Summary
                    </Button>
                    {aiSummary && (
                      <Card className="p-4 bg-muted/50 text-sm whitespace-pre-wrap">
                        {aiSummary}
                      </Card>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRows.size > 0 && (
        <Card className="glass-card p-3 border-primary/30 glow-blue">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              {selectedRows.size} selected
            </Badge>
            <Select value={bulkKeyId} onValueChange={(v: string | null) => setBulkKeyId(v ?? "")}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select explanation key" />
              </SelectTrigger>
              <SelectContent>
                {explanationKeys.map(k => (
                  <SelectItem key={k.id} value={k.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: k.color ?? "#6366f1" }}
                      />
                      {k.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleBulkAssign}
              disabled={!bulkKeyId}
            >
              <Tag className="h-3.5 w-3.5" />
              Assign Key
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setAiPanelOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Explain
            </Button>
          </div>
        </Card>
      )}

      {/* Results Table */}
      <Card className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Results ({total})
          </h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No results match the current filters.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedRows.size > 0 &&
                      selectedRows.size === results.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-10" />
                <TableHead>Row Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Explanation Key</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map(result => (
                <Fragment key={result.id}>
                  <TableRow
                    className={cn(
                      "cursor-pointer",
                      expandedRows.has(result.id) && "bg-accent/20"
                    )}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRows.has(result.id)}
                        onCheckedChange={() => toggleSelect(result.id)}
                      />
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(result.id)}>
                      {expandedRows.has(result.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell
                      className="font-mono text-sm"
                      onClick={() => toggleExpand(result.id)}
                    >
                      {result.rowKeyValue}
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(result.id)}>
                      {statusBadge(result.status)}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {result.explanationKey ? (
                        <Badge
                          style={{
                            backgroundColor: `${result.explanationKey.color}20`,
                            color: result.explanationKey.color ?? undefined,
                            borderColor: `${result.explanationKey.color}40`
                          }}
                        >
                          {result.explanationKey.label}
                        </Badge>
                      ) : (
                        <Select
                          value=""
                          onValueChange={(v: string | null) =>
                            handleAssignKey(result.id, v || null)
                          }
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue placeholder="Assign key..." />
                          </SelectTrigger>
                          <SelectContent>
                            {explanationKeys.map(k => (
                              <SelectItem key={k.id} value={k.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                      backgroundColor: k.color ?? "#6366f1"
                                    }}
                                  />
                                  {k.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {result.status === "break" &&
                          !result.explanationKey && (
                            <KeySuggestionInline
                              resultId={result.id}
                              projectId={projectId}
                              explanationKeys={explanationKeys}
                              onAssign={(rid, kid) =>
                                handleAssignKey(rid, kid)
                              }
                            />
                          )}
                        {result.aiExplanation && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1"
                          >
                            <Sparkles className="h-3 w-3" />
                            AI
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded field details */}
                  {expandedRows.has(result.id) && (
                    <TableRow key={`${result.id}-details`}>
                      <TableCell colSpan={6} className="p-0">
                        <div className="bg-muted/30 px-8 py-4">
                          {loadingDetails.has(result.id) ? (
                            <div className="space-y-2">
                              {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-8 w-full" />
                              ))}
                            </div>
                          ) : rowDetails.has(result.id) ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">
                                    Field
                                  </TableHead>
                                  <TableHead className="text-xs">
                                    Value A
                                  </TableHead>
                                  <TableHead className="text-xs">
                                    Value B
                                  </TableHead>
                                  <TableHead className="text-xs">
                                    Diff
                                  </TableHead>
                                  <TableHead className="text-xs text-center">
                                    Match
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(rowDetails.get(result.id) ?? []).map(
                                  (fd) => (
                                    <TableRow key={fd.id}>
                                      <TableCell className="font-mono text-xs">
                                        {context?.fieldMappingNames[fd.fieldMappingId] ?? fd.fieldMappingId.substring(0, 8)}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {fd.valueA ?? "-"}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {fd.valueB ?? "-"}
                                      </TableCell>
                                      <TableCell className="text-sm font-mono">
                                        {fd.numericDiff ?? "-"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {fd.isMatch ? (
                                          <Check className="h-4 w-4 text-green-400 mx-auto" />
                                        ) : (
                                          <X className="h-4 w-4 text-red-400 mx-auto" />
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  )
                                )}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No field details available
                            </p>
                          )}

                          {result.aiExplanation && (
                            <div className="mt-3 p-3 rounded-lg bg-background/50 border border-border/50">
                              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                AI Explanation
                              </p>
                              <p className="text-sm">
                                {result.aiExplanation}
                              </p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
