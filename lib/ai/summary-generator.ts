import { getAIClient, DEFAULT_MODEL } from "./client"
import { summaryGeneratorPrompt } from "./prompts"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"

export async function generateSummary(stats: {
  totalRows: number
  matched: number
  breaks: number
  explained: number
  unexplained: number
  topCategories: Array<{ category: string; count: number }>
  topExplanationKeys: Array<{ code: string; count: number }>
}): Promise<string> {
  try {
    const { system, userMessage } = summaryGeneratorPrompt(stats)

    const cacheKey = generateCacheKey(
      `summary:${JSON.stringify(stats)}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as string
    }

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userMessage }],
    })

    const summary =
      response.content[0].type === "text" ? response.content[0].text : ""

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "summary",
      userMessage,
      summary,
      DEFAULT_MODEL,
      tokensUsed
    )

    return summary
  } catch (error) {
    console.error("Failed to generate summary:", error)
    return "Unable to generate summary. Please review the reconciliation statistics manually."
  }
}
