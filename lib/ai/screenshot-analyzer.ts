import { getAIClient, DEFAULT_MODEL } from "./client"
import { screenshotComparePrompt } from "./prompts"
import { generateCacheKey, getCachedResult, setCacheResult } from "./cache"
import { parseJsonFromResponse } from "./utils"

export interface ScreenshotDifference {
  location: string
  valueA: string
  valueB: string
  likelyCause: string
  severity: "high" | "medium" | "low"
}

export async function compareScreenshots(
  imageABase64: string,
  imageBBase64: string
): Promise<ScreenshotDifference[]> {
  try {
    const { system, userMessage } = screenshotComparePrompt()

    const cacheKey = generateCacheKey(
      `screenshot-compare:${imageABase64.slice(0, 100)}:${imageBBase64.slice(0, 100)}`
    )

    const cached = await getCachedResult(cacheKey)
    if (cached) {
      return cached as ScreenshotDifference[]
    }

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageABase64,
              },
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageBBase64,
              },
            },
            {
              type: "text",
              text: userMessage + '\n\nReturn JSON array: [{ "location": string, "valueA": string, "valueB": string, "likelyCause": string, "severity": "high"|"medium"|"low" }]',
            },
          ],
        },
      ],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const differences: ScreenshotDifference[] = parseJsonFromResponse(text)

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    await setCacheResult(
      cacheKey,
      "screenshot-compare",
      "screenshot comparison",
      differences,
      DEFAULT_MODEL,
      tokensUsed
    )

    return differences
  } catch (error) {
    console.error("Failed to compare screenshots:", error)
    return []
  }
}
