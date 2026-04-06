import Anthropic from "@anthropic-ai/sdk"

let client: Anthropic | null = null

export function getAIClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

export const DEFAULT_MODEL = process.env.AI_MODEL || "claude-sonnet-4-20250514"
