/**
 * Parse JSON from Claude's response text, handling markdown code blocks.
 */
export function parseJsonFromResponse(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {
    // Try extracting from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }

    // Try finding JSON array or object in the text
    const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }

    throw new Error("Could not parse JSON from AI response")
  }
}
