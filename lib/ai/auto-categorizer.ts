import { getAIClient, DEFAULT_MODEL } from "./client"
import { autoCategorizePrompt } from "./prompts"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface CategoryResult {
  rowKey: string
  fieldName: string
  category: string
  confidence: number
}

type BreakInput = {
  rowKey: string
  fieldName: string
  valueA: string
  valueB: string
  diff?: number
}

export async function categorizeBreaks(
  breaks: BreakInput[]
): Promise<CategoryResult[]> {
  try {
    const { system, userMessage } = autoCategorizePrompt(breaks)

    const cacheKey = generateCacheKey(
      `auto-categorize:${JSON.stringify(breaks)}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as CategoryResult[]
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
    const categories: CategoryResult[] = parseJsonFromResponse(text)

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "auto-categorize",
      userMessage,
      categories,
      DEFAULT_MODEL,
      tokensUsed
    )

    return categories
  } catch (error) {
    console.error("Failed to categorize breaks:", error)
    return []
  }
}
