import { getAIClient, DEFAULT_MODEL } from "./client"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface ExplanationKeySuggestion {
  keyCode: string
  keyLabel: string
  keyId: string
  confidence: number
  reason: string
}

export async function suggestExplanationKey(
  breakData: {
    rowKey: string
    fieldDetails: Array<{
      fieldName: string
      valueA: string | null
      valueB: string | null
      numericDiff: string | null
      isMatch: boolean
    }>
  },
  explanationKeys: Array<{ id: string; code: string; label: string; description: string | null }>
): Promise<ExplanationKeySuggestion[]> {
  try {
    const system =
      "You are an expert at classifying financial reconciliation breaks. " +
      "Given a break's field details and available explanation keys, suggest the most appropriate key. " +
      "Return up to 3 suggestions ranked by confidence. Be specific about why each key applies. Return valid JSON only."

    const userMessage = `Break for row "${breakData.rowKey}":\n${JSON.stringify(breakData.fieldDetails, null, 2)}\n\n` +
      `Available explanation keys:\n${JSON.stringify(explanationKeys, null, 2)}\n\n` +
      `Return JSON array: [{ "keyCode": string, "keyLabel": string, "keyId": string, "confidence": number, "reason": string }]`

    const cacheKey = generateCacheKey(
      `explain-key-suggest:${breakData.rowKey}:${JSON.stringify(breakData.fieldDetails)}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as ExplanationKeySuggestion[]
    }

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const suggestions: ExplanationKeySuggestion[] = parseJsonFromResponse(text)

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "explain-key-suggest",
      userMessage,
      suggestions,
      DEFAULT_MODEL,
      tokensUsed
    )

    return suggestions
  } catch (error) {
    console.error("Failed to suggest explanation key:", error)
    return []
  }
}
