"use client"

import { useState } from "react"
import {
  analyzeBreakPatternsAction,
  applyBreakAnalysisSuggestionsAction,
} from "@/actions/ai-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Minus,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface FieldEvidence {
  fieldName: string
  observation: string
  direction: "increased" | "decreased" | "mixed" | "unchanged"
  avgMagnitude: number
  isKeyDriver: boolean
}

interface AnomalyFieldDetail {
  fieldName: string
  valueA: string
  valueB: string
  observation: string
}

interface BreakCluster {
  name: string
  description: string
  tradeCount: number
  tradeIds: string[]
  suggestedKeyCode: string
  confidence: number
  avgDiff: number
  fieldEvidence?: FieldEvidence[]
}

interface BreakAnomaly {
  tradeId: string
  reason: string
  severity: string
  fieldDetails?: AnomalyFieldDetail[]
}

interface BreakPatternAnalysis {
  clusters: BreakCluster[]
  anomalies: BreakAnomaly[]
  summary: string
  totalBreaksAnalyzed: number
}

interface BreakAnalysisPanelProps {
  runId: string
  projectId: string
  onApplied: () => void
}

const directionIcon = (dir: string) => {
  switch (dir) {
    case "increased": return <TrendingUp className="h-3 w-3 text-red-400" />
    case "decreased": return <TrendingDown className="h-3 w-3 text-blue-400" />
    case "mixed": return <ArrowUpDown className="h-3 w-3 text-amber-400" />
    default: return <Minus className="h-3 w-3 text-muted-foreground" />
  }
}

export function BreakAnalysisPanel({
  runId,
  projectId,
  onApplied,
}: BreakAnalysisPanelProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [analysis, setAnalysis] = useState<BreakPatternAnalysis | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set())
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<number>>(new Set())

  async function handleAnalyze() {
    setOpen(true)
    setLoading(true)
    setAnalysis(null)
    setExpandedClusters(new Set())
    setExpandedAnomalies(new Set())

    try {
      const result = await analyzeBreakPatternsAction(runId)
      if (result.status === "success") {
        setAnalysis(result.data)
      } else {
        toast.error(result.message)
        setOpen(false)
      }
    } catch {
      toast.error("Break pattern analysis failed")
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyAll() {
    if (!analysis || analysis.clusters.length === 0) return
    setApplying(true)
    try {
      const clusters = analysis.clusters.map(c => ({
        tradeIds: c.tradeIds,
        suggestedKeyCode: c.suggestedKeyCode,
      }))
      const result = await applyBreakAnalysisSuggestionsAction(runId, clusters)
      if (result.status === "success") {
        toast.success(`Applied explanation keys to ${result.data.updatedCount} trades`)
        setOpen(false)
        onApplied()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to apply suggestions")
    } finally {
      setApplying(false)
    }
  }

  function toggleCluster(i: number) {
    const next = new Set(expandedClusters)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setExpandedClusters(next)
  }

  function toggleAnomaly(i: number) {
    const next = new Set(expandedAnomalies)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setExpandedAnomalies(next)
  }

  function confidenceColor(confidence: number) {
    if (confidence >= 80) return "bg-green-500/20 text-green-400 border-green-500/30"
    if (confidence >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    return "bg-red-500/20 text-red-400 border-red-500/30"
  }

  function severityColor(severity: string) {
    switch (severity) {
      case "high": return "border-red-500/40 bg-red-500/10"
      case "medium": return "border-amber-500/40 bg-amber-500/10"
      default: return "border-orange-500/40 bg-orange-500/10"
    }
  }

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={handleAnalyze}>
        <Sparkles className="h-4 w-4" />
        AI Break Analysis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Break Pattern Analysis
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing break patterns across all trades...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take 10-30 seconds depending on the number of breaks
              </p>
            </div>
          ) : analysis ? (
            <div className="space-y-5">
              {/* Summary */}
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {analysis.totalBreaksAnalyzed} breaks analyzed
                  {analysis.clusters.length > 0 &&
                    ` — ${analysis.clusters.reduce((s, c) => s + c.tradeCount, 0)} classified into ${analysis.clusters.length} clusters`}
                  {analysis.anomalies.length > 0 &&
                    ` — ${analysis.anomalies.length} anomalies flagged`}
                </p>
              </Card>

              {/* Clusters */}
              {analysis.clusters.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">
                    Pattern Clusters ({analysis.clusters.length})
                  </h4>
                  <div className="space-y-2">
                    {analysis.clusters.map((cluster, i) => (
                      <Card key={i} className="overflow-hidden bg-muted/20">
                        {/* Cluster header — clickable */}
                        <button
                          onClick={() => toggleCluster(i)}
                          className="flex items-start justify-between gap-2 w-full p-3 text-left hover:bg-accent/20 transition-colors"
                        >
                          <div className="flex items-start gap-2 flex-1">
                            {expandedClusters.has(i) ? (
                              <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{cluster.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {cluster.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs">
                              {cluster.tradeCount} trades
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs bg-primary/10 text-primary border-primary/30"
                            >
                              {cluster.suggestedKeyCode}
                            </Badge>
                            <Badge className={confidenceColor(cluster.confidence)}>
                              {cluster.confidence}%
                            </Badge>
                          </div>
                        </button>

                        {/* Expanded: field evidence */}
                        {expandedClusters.has(i) && (
                          <div className="border-t border-border/30 px-3 pb-3">
                            {cluster.fieldEvidence && cluster.fieldEvidence.length > 0 ? (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">
                                  Field-by-Field Evidence
                                </p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Field</TableHead>
                                      <TableHead className="text-xs">Direction</TableHead>
                                      <TableHead className="text-xs">Avg Change</TableHead>
                                      <TableHead className="text-xs">Key Driver</TableHead>
                                      <TableHead className="text-xs">Observation</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {cluster.fieldEvidence.map((fe, j) => (
                                      <TableRow key={j} className={cn(fe.isKeyDriver && "bg-primary/5")}>
                                        <TableCell className="text-xs font-mono font-medium">
                                          {fe.fieldName}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1.5">
                                            {directionIcon(fe.direction)}
                                            <span className="text-xs capitalize">{fe.direction}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                          {typeof fe.avgMagnitude === "number"
                                            ? fe.avgMagnitude.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                            : "—"}
                                        </TableCell>
                                        <TableCell>
                                          {fe.isKeyDriver && (
                                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                                              Primary
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                                          {fe.observation}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-2">
                                No per-field evidence available for this cluster.
                              </p>
                            )}

                            {/* Trade IDs */}
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Trades in this cluster ({cluster.tradeIds.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {cluster.tradeIds.slice(0, 20).map(id => (
                                  <Badge key={id} variant="outline" className="text-[10px] font-mono">
                                    {id}
                                  </Badge>
                                ))}
                                {cluster.tradeIds.length > 20 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    +{cluster.tradeIds.length - 20} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {analysis.anomalies.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Anomalies ({analysis.anomalies.length})
                  </h4>
                  <div className="space-y-1.5">
                    {analysis.anomalies.map((anomaly, i) => (
                      <div key={i} className={`rounded-md border ${severityColor(anomaly.severity)}`}>
                        <button
                          onClick={() => toggleAnomaly(i)}
                          className="flex items-start gap-2 w-full p-2.5 text-left"
                        >
                          {expandedAnomalies.has(i) ? (
                            <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          )}
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-mono font-medium">
                              {anomaly.tradeId}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {anomaly.reason}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {anomaly.severity}
                          </Badge>
                        </button>

                        {/* Expanded anomaly field details */}
                        {expandedAnomalies.has(i) && anomaly.fieldDetails && anomaly.fieldDetails.length > 0 && (
                          <div className="border-t border-border/30 px-3 pb-3 pt-2">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Field</TableHead>
                                  <TableHead className="text-xs">Value A</TableHead>
                                  <TableHead className="text-xs">Value B</TableHead>
                                  <TableHead className="text-xs">Observation</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {anomaly.fieldDetails.map((fd, j) => (
                                  <TableRow key={j}>
                                    <TableCell className="text-xs font-mono">{fd.fieldName}</TableCell>
                                    <TableCell className="text-xs">{fd.valueA}</TableCell>
                                    <TableCell className="text-xs">{fd.valueB}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{fd.observation}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply All Button */}
              {analysis.clusters.length > 0 && (
                <Button className="w-full gap-2" onClick={handleApplyAll} disabled={applying}>
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Apply All Suggestions ({analysis.clusters.reduce((s, c) => s + c.tradeCount, 0)} trades)
                </Button>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
