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
import { Sparkles, Loader2, AlertTriangle, Check } from "lucide-react"
import { toast } from "sonner"

interface BreakCluster {
  name: string
  description: string
  tradeCount: number
  tradeIds: string[]
  suggestedKeyCode: string
  confidence: number
  avgDiff: number
}

interface BreakAnomaly {
  tradeId: string
  reason: string
  severity: string
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

export function BreakAnalysisPanel({
  runId,
  projectId,
  onApplied,
}: BreakAnalysisPanelProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [analysis, setAnalysis] = useState<BreakPatternAnalysis | null>(null)

  async function handleAnalyze() {
    setOpen(true)
    setLoading(true)
    setAnalysis(null)

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
        toast.success(
          `Applied explanation keys to ${result.data.updatedCount} trades`
        )
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

  function confidenceColor(confidence: number) {
    if (confidence >= 80) return "bg-green-500/20 text-green-400 border-green-500/30"
    if (confidence >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    return "bg-red-500/20 text-red-400 border-red-500/30"
  }

  function severityColor(severity: string) {
    switch (severity) {
      case "high":
        return "border-red-500/40 bg-red-500/10"
      case "medium":
        return "border-amber-500/40 bg-amber-500/10"
      default:
        return "border-orange-500/40 bg-orange-500/10"
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={handleAnalyze}
      >
        <Sparkles className="h-4 w-4" />
        AI Break Analysis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Break Pattern Analysis
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing break patterns across all trades...
              </p>
            </div>
          ) : analysis ? (
            <div className="space-y-5">
              {/* Summary */}
              <Card className="p-4 bg-muted/30">
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {analysis.totalBreaksAnalyzed} breaks analyzed
                </p>
              </Card>

              {/* Clusters */}
              {analysis.clusters.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">
                    Clusters ({analysis.clusters.length})
                  </h4>
                  <div className="space-y-2">
                    {analysis.clusters.map((cluster, i) => (
                      <Card
                        key={i}
                        className="p-3 bg-muted/20 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{cluster.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cluster.description}
                            </p>
                          </div>
                          <Badge className={confidenceColor(cluster.confidence)}>
                            {cluster.confidence}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {cluster.tradeCount} trades
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs bg-primary/10 text-primary border-primary/30"
                          >
                            {cluster.suggestedKeyCode}
                          </Badge>
                          {cluster.avgDiff !== 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              avg diff: {cluster.avgDiff.toFixed(4)}
                            </span>
                          )}
                        </div>
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
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md border p-2.5 ${severityColor(anomaly.severity)}`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono font-medium">
                            {anomaly.tradeId}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {anomaly.reason}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0"
                        >
                          {anomaly.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply All Button */}
              {analysis.clusters.length > 0 && (
                <Button
                  className="w-full gap-2"
                  onClick={handleApplyAll}
                  disabled={applying}
                >
                  {applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Apply All Suggestions
                </Button>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
