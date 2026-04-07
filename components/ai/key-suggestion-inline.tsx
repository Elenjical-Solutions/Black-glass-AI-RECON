"use client"

import { useState } from "react"
import { suggestExplanationKeyAction } from "@/actions/ai-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import type { ExplanationKey } from "@/db/schema/explanation-keys-schema"

interface KeySuggestionInlineProps {
  resultId: string
  projectId: string
  explanationKeys: ExplanationKey[]
  onAssign: (resultId: string, keyId: string) => void
}

interface Alternative {
  code: string
  confidence: number
  reason: string
}

interface SuggestionResult {
  suggestedKeyCode: string
  confidence: number
  reasoning: string
  alternatives: Alternative[]
}

export function KeySuggestionInline({
  resultId,
  projectId,
  explanationKeys,
  onAssign,
}: KeySuggestionInlineProps) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null)
  const [showAlternatives, setShowAlternatives] = useState(false)

  async function handleSuggest() {
    setLoading(true)
    setSuggestion(null)

    try {
      const result = await suggestExplanationKeyAction(resultId, projectId)
      if (result.status === "success") {
        setSuggestion(result.data)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to get suggestion")
    } finally {
      setLoading(false)
    }
  }

  function findKeyByCode(code: string) {
    return explanationKeys.find(
      k => k.code === code || k.label === code
    )
  }

  function handleApplyKey(code: string) {
    const key = findKeyByCode(code)
    if (key) {
      onAssign(resultId, key.id)
      setSuggestion(null)
    } else {
      toast.error(`Key "${code}" not found`)
    }
  }

  if (loading) {
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    )
  }

  if (suggestion) {
    const primaryKey = findKeyByCode(suggestion.suggestedKeyCode)

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 bg-primary/10 text-primary border-primary/30"
          >
            {suggestion.suggestedKeyCode} ({suggestion.confidence}%)
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => handleApplyKey(suggestion.suggestedKeyCode)}
            title="Apply this suggestion"
          >
            <Check className="h-3 w-3 text-green-400" />
          </Button>
          {suggestion.alternatives.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setShowAlternatives(!showAlternatives)}
            >
              {showAlternatives ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>

        {showAlternatives && suggestion.alternatives.length > 0 && (
          <div className="flex flex-col gap-0.5 pl-1">
            {suggestion.alternatives.map((alt, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {alt.code} ({alt.confidence}%)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => handleApplyKey(alt.code)}
                >
                  <Check className="h-2.5 w-2.5 text-muted-foreground hover:text-green-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={handleSuggest}
      title="AI suggest explanation key"
    >
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
    </Button>
  )
}
