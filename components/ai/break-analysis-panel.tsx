"use client"

import { useState } from "react"
import { analyzeBreakPatternsAction } from "@/actions/ai-actions"
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
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Minus,
  Search,
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
  avgDiff: number
  fieldEvidence?: FieldEvidence[]
  // Legacy — may still come from AI but we don't display it prominently
  suggestedKeyCode?: string
  confidence?: number
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

export function BreakAnalysisPanel({ runId }: BreakAnalysisPanelProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
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
      toast.error("Analysis failed")
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  function toggleCluster(i: number) {
    const next = new Set(expandedClusters)
    if (next.has(i)) next.delete(i); else next.add(i)
    setExpandedClusters(next)
  }

  function toggleAnomaly(i: number) {
    const next = new Set(expandedAnomalies)
    if (next.has(i)) next.delete(i); else next.add(i)
    setExpandedAnomalies(next)
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
      <Button variant="outline" className="gap-2" onClick={handleAnalyze} title="Discover break patterns — does NOT assign keys">
        <Search className="h-4 w-4" />
        Discover Patterns
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Pattern Discovery
              <Badge variant="outline" className="text-[10px] font-normal ml-2">Analysis only — does not assign keys</Badge>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Discovering break patterns...</p>
              <p className="text-xs text-muted-foreground">This may take 10-30 seconds</p>
            </div>
          ) : analysis ? (
            <div className="space-y-5">
              {/* Summary */}
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {analysis.totalBreaksAnalyzed} breaks analyzed
                  {analysis.clusters.length > 0 && ` — ${analysis.clusters.reduce((s, c) => s + c.tradeCount, 0)} grouped into ${analysis.clusters.length} clusters`}
                  {analysis.anomalies.length > 0 && ` — ${analysis.anomalies.length} anomalies`}
                </p>
              </Card>

              {/* Tip */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  This is <strong>discovery only</strong> — it shows what patterns exist in your breaks.
                  To assign explanation keys, use <strong>"AI Apply My Rules"</strong> after writing natural language rules on your explanation keys.
                </p>
              </div>

              {/* Clusters */}
              {analysis.clusters.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Discovered Clusters ({analysis.clusters.length})</h4>
                  <div className="space-y-2">
                    {analysis.clusters.map((cluster, i) => (
                      <Card key={i} className="overflow-hidden bg-muted/20">
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
                              <p className="text-xs text-muted-foreground mt-0.5">{cluster.description}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {cluster.tradeCount} trades
                          </Badge>
                        </button>

                        {expandedClusters.has(i) && (
                          <div className="border-t border-border/30 px-3 pb-3">
                            {cluster.fieldEvidence && cluster.fieldEvidence.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Field-by-Field Observations</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Field</TableHead>
                                      <TableHead className="text-xs">Direction</TableHead>
                                      <TableHead className="text-xs">Avg Change</TableHead>
                                      <TableHead className="text-xs">Driver</TableHead>
                                      <TableHead className="text-xs">What AI Observes</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {cluster.fieldEvidence.map((fe, j) => (
                                      <TableRow key={j} className={cn(fe.isKeyDriver && "bg-primary/5")}>
                                        <TableCell className="text-xs font-mono font-medium">{fe.fieldName}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1.5">
                                            {directionIcon(fe.direction)}
                                            <span className="text-xs capitalize">{fe.direction}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                          {typeof fe.avgMagnitude === "number" ? fe.avgMagnitude.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
                                        </TableCell>
                                        <TableCell>
                                          {fe.isKeyDriver && <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Primary</Badge>}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[250px]">{fe.observation}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Trades ({cluster.tradeIds.length})</p>
                              <div className="flex flex-wrap gap-1">
                                {cluster.tradeIds.slice(0, 15).map(id => (
                                  <Badge key={id} variant="outline" className="text-[10px] font-mono">{id}</Badge>
                                ))}
                                {cluster.tradeIds.length > 15 && (
                                  <Badge variant="secondary" className="text-[10px]">+{cluster.tradeIds.length - 15} more</Badge>
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
                        <button onClick={() => toggleAnomaly(i)} className="flex items-start gap-2 w-full p-2.5 text-left">
                          {expandedAnomalies.has(i) ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />}
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-mono font-medium">{anomaly.tradeId}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{anomaly.reason}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">{anomaly.severity}</Badge>
                        </button>
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

              {/* No "Apply" button — this is discovery only */}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
