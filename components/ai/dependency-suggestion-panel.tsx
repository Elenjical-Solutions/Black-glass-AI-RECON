"use client"

import { useState } from "react"
import { suggestDependenciesAction } from "@/actions/ai-actions"
import { addDependencyEdgeAction } from "@/actions/dependency-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Check, GitBranch } from "lucide-react"
import { toast } from "sonner"

interface DependencySuggestion {
  definitionId: string
  definitionName: string
  confidence: number
  reason: string
  sharedColumns: string[]
}

interface DependencySuggestionPanelProps {
  definitionId: string
  projectId: string
  onEdgeAdded: () => void
}

export function DependencySuggestionPanel({
  definitionId,
  projectId,
  onEdgeAdded,
}: DependencySuggestionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<DependencySuggestion[] | null>(
    null
  )
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  async function handleSuggest() {
    setLoading(true)
    setSuggestions(null)

    try {
      const result = await suggestDependenciesAction(definitionId, projectId)
      if (result.status === "success") {
        setSuggestions(result.data.suggestions)
        if (result.data.suggestions.length === 0) {
          toast.info("No dependency suggestions found")
        }
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to get dependency suggestions")
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(suggestion: DependencySuggestion) {
    setAcceptingId(suggestion.definitionId)

    try {
      const result = await addDependencyEdgeAction({
        projectId,
        parentDefinitionId: suggestion.definitionId,
        childDefinitionId: definitionId,
        propagationRule: {
          sharedColumns: suggestion.sharedColumns,
          aiSuggested: true,
          confidence: suggestion.confidence,
        },
      })

      if (result.status === "success") {
        toast.success(`Added dependency: ${suggestion.definitionName}`)
        setSuggestions(prev =>
          prev ? prev.filter(s => s.definitionId !== suggestion.definitionId) : null
        )
        onEdgeAdded()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to add dependency")
    } finally {
      setAcceptingId(null)
    }
  }

  function confidenceColor(confidence: number) {
    if (confidence >= 80)
      return "bg-green-500/20 text-green-400 border-green-500/30"
    if (confidence >= 60)
      return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    return "bg-red-500/20 text-red-400 border-red-500/30"
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center gap-2 text-xs"
        onClick={handleSuggest}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        AI Suggest Dependencies
      </Button>

      {loading && (
        <div className="flex items-center justify-center py-3 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analyzing...</span>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map(suggestion => (
            <Card
              key={suggestion.definitionId}
              className="p-2.5 bg-muted/20 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GitBranch className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span className="text-xs font-medium truncate">
                    {suggestion.definitionName}
                  </span>
                </div>
                <Badge
                  className={`text-[10px] shrink-0 ${confidenceColor(suggestion.confidence)}`}
                >
                  {suggestion.confidence}%
                </Badge>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {suggestion.reason}
              </p>

              {suggestion.sharedColumns.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestion.sharedColumns.slice(0, 4).map(col => (
                    <Badge
                      key={col}
                      variant="secondary"
                      className="text-[9px] px-1 py-0 h-4"
                    >
                      {col}
                    </Badge>
                  ))}
                  {suggestion.sharedColumns.length > 4 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{suggestion.sharedColumns.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full h-6 text-[10px] gap-1"
                onClick={() => handleAccept(suggestion)}
                disabled={acceptingId === suggestion.definitionId}
              >
                {acceptingId === suggestion.definitionId ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Accept
              </Button>
            </Card>
          ))}
        </div>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          No upstream dependencies suggested
        </p>
      )}
    </div>
  )
}
