import { getAIClient, DEFAULT_MODEL } from "./client"
import { diffExplainerPrompt } from "./prompts"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface DiffExplanation {
  rowKey: string
  fieldName: string
  explanation: string
  category: string
  confidence: number
}

type BreakInput = {
  rowKey: string
  fieldName: string
  valueA: string
  valueB: string
  numericDiff?: number
}

const BATCH_SIZE = 50

async function explainBatch(breaks: BreakInput[]): Promise<DiffExplanation[]> {
  const { system, userMessage } = diffExplainerPrompt(breaks)

  const cacheKey = generateCacheKey(
    `diff-explain:${JSON.stringify(breaks)}`
  )

  const cached = await getCachedResult(cacheKey)
  if (cached) {
    return cached as DiffExplanation[]
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
  const explanations: DiffExplanation[] = parseJsonFromResponse(text)

  const tokensUsed =
    (response.usage?.input_tokens ?? 0) +
    (response.usage?.output_tokens ?? 0)

  await setCacheResult(
    cacheKey,
    "diff-explain",
    userMessage,
    explanations,
    DEFAULT_MODEL,
    tokensUsed
  )

  return explanations
}

export async function explainDifferences(
  breaks: BreakInput[]
): Promise<DiffExplanation[]> {
  try {
    if (breaks.length <= BATCH_SIZE) {
      return await explainBatch(breaks)
    }

    const results: DiffExplanation[] = []
    for (let i = 0; i < breaks.length; i += BATCH_SIZE) {
      const batch = breaks.slice(i, i + BATCH_SIZE)
      const batchResults = await explainBatch(batch)
      results.push(...batchResults)
    }
    return results
  } catch (error) {
    console.error("Failed to explain differences:", error)
    return []
  }
}
