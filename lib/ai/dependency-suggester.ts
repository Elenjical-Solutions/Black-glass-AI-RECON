import { getAIClient, DEFAULT_MODEL } from "./client"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface DependencySuggestion {
  parentDefinitionId: string
  parentDefinitionName: string
  confidence: number
  reason: string
  sharedColumns: string[]
}

export async function suggestDependencies(
  targetDefinition: {
    id: string
    name: string
    category: string | null
    fieldNames: string[]
  },
  allDefinitions: Array<{
    id: string
    name: string
    category: string | null
    department: string | null
    fieldNames: string[]
  }>
): Promise<DependencySuggestion[]> {
  try {
    const system =
      "You are an expert in financial reconciliation dependency analysis. " +
      "Given a downstream definition and all available definitions, suggest which upstream definitions " +
      "should be parents based on shared field names, category relationships, and naming conventions. " +
      "Core definitions feed sensitivity definitions, which feed downstream reports. " +
      "Look for shared columns like trade_id, portfolio, currency, etc. Return valid JSON only."

    const candidates = allDefinitions.filter(d => d.id !== targetDefinition.id)

    const userMessage = `Target (downstream) definition:\n${JSON.stringify(targetDefinition, null, 2)}\n\n` +
      `Available parent candidates:\n${JSON.stringify(candidates, null, 2)}\n\n` +
      `Return JSON array: [{ "parentDefinitionId": string, "parentDefinitionName": string, "confidence": number, "reason": string, "sharedColumns": string[] }]`

    const cacheKey = generateCacheKey(
      `dep-suggest:${targetDefinition.id}:${candidates.map(c => c.id).join(",")}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as DependencySuggestion[]
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
    const suggestions: DependencySuggestion[] = parseJsonFromResponse(text)

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "dep-suggest",
      userMessage,
      suggestions,
      DEFAULT_MODEL,
      tokensUsed
    )

    return suggestions
  } catch (error) {
    console.error("Failed to suggest dependencies:", error)
    return []
  }
}
