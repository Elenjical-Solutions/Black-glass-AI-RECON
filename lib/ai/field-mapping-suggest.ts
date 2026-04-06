import { getAIClient, DEFAULT_MODEL } from "./client"
import { fieldMappingSuggestPrompt } from "./prompts"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface SuggestedMapping {
  fieldA: string
  fieldB: string
  confidence: number
  matcherType: "text" | "number" | "date"
  suggestedTolerance?: number
}

export async function suggestFieldMappings(
  headersA: string[],
  headersB: string[],
  sampleRowsA?: Record<string, string>[],
  sampleRowsB?: Record<string, string>[]
): Promise<SuggestedMapping[]> {
  try {
    const { system, userMessage } = fieldMappingSuggestPrompt(
      headersA,
      headersB,
      sampleRowsA,
      sampleRowsB
    )

    const cacheKey = generateCacheKey(
      `field-mapping:${JSON.stringify({ headersA, headersB, sampleRowsA, sampleRowsB })}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as SuggestedMapping[]
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
    const parsed = parseJsonFromResponse(text)
    const mappings: SuggestedMapping[] = parsed.mappings ?? parsed

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "field-mapping",
      userMessage,
      mappings,
      DEFAULT_MODEL,
      tokensUsed
    )

    return mappings
  } catch (error) {
    console.error("Failed to suggest field mappings:", error)
    return []
  }
}
