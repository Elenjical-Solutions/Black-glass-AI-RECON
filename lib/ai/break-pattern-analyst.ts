import { getAIClient, DEFAULT_MODEL } from "./client"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface BreakCluster {
  name: string
  description: string
  tradeCount: number
  suggestedKey: string
  confidence: number
  sampleRowKeys: string[]
}

export interface BreakAnomaly {
  rowKey: string
  reason: string
  severity: "high" | "medium" | "low"
}

export interface BreakPatternAnalysis {
  summary: string
  clusters: BreakCluster[]
  anomalies: BreakAnomaly[]
}

export async function analyzeBreakPatterns(
  breakData: Array<{
    rowKey: string
    fieldDetails: Array<{
      fieldName: string
      valueA: string | null
      valueB: string | null
      numericDiff: string | null
      isMatch: boolean
    }>
  }>,
  explanationKeys: Array<{ code: string; label: string }>
): Promise<BreakPatternAnalysis> {
  try {
    const system =
      "You are an expert financial reconciliation analyst. Analyze break patterns in reconciliation data. " +
      "Group breaks into clusters based on shared characteristics (e.g., same field breaking, similar magnitude, same product type). " +
      "For each cluster, suggest the most appropriate explanation key from the available list. " +
      "Also flag any anomalous breaks that don't fit patterns. Return valid JSON only."

    const userMessage = `Break data (${breakData.length} breaks):\n${JSON.stringify(breakData.slice(0, 100), null, 2)}\n\n` +
      `Available explanation keys: ${JSON.stringify(explanationKeys)}\n\n` +
      `Return JSON: { "summary": string, "clusters": [{ "name": string, "description": string, "tradeCount": number, "suggestedKey": string, "confidence": number, "sampleRowKeys": string[] }], "anomalies": [{ "rowKey": string, "reason": string, "severity": "high"|"medium"|"low" }] }`

    const cacheKey = generateCacheKey(
      `break-patterns:${JSON.stringify({ count: breakData.length, keys: explanationKeys.map(k => k.code) })}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as BreakPatternAnalysis
    }

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = parseJsonFromResponse(text) as BreakPatternAnalysis

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "break-patterns",
      userMessage,
      parsed,
      DEFAULT_MODEL,
      tokensUsed
    )

    return parsed
  } catch (error) {
    console.error("Failed to analyze break patterns:", error)
    return { summary: "Analysis failed", clusters: [], anomalies: [] }
  }
}
