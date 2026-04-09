/**
 * Parse JSON from Claude's response text, handling:
 * - Raw JSON
 * - Markdown code blocks
 * - Embedded JSON in text
 * - TRUNCATED JSON (common with large responses hitting max_tokens)
 */
export function parseJsonFromResponse(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {
    // noop
  }

  // Try extracting from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // Code block JSON might also be truncated
      return repairAndParse(codeBlockMatch[1].trim())
    }
  }

  // Try finding JSON object or array in the text
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch {
      return repairAndParse(jsonMatch[1])
    }
  }

  // Last resort: find the start of JSON and try to repair
  const jsonStart = text.indexOf("{")
  if (jsonStart >= 0) {
    return repairAndParse(text.slice(jsonStart))
  }

  const arrayStart = text.indexOf("[")
  if (arrayStart >= 0) {
    return repairAndParse(text.slice(arrayStart))
  }

  throw new Error("Could not parse JSON from AI response")
}

/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * Common issue: Claude hits max_tokens and the JSON is cut off mid-array.
 */
function repairAndParse(text: string): any {
  let repaired = text.trim()

  // Remove trailing comma (common truncation point)
  repaired = repaired.replace(/,\s*$/, "")

  // Remove incomplete last property (e.g., `"reasoning": "some text that got cu`)
  // Match: trailing incomplete string value
  repaired = repaired.replace(/,?\s*"[^"]*":\s*"[^"]*$/, "")
  // Match: trailing incomplete key
  repaired = repaired.replace(/,?\s*"[^"]*$/, "")

  // Count open/close brackets
  let openBraces = 0
  let openBrackets = 0
  let inString = false
  let escaped = false

  for (const char of repaired) {
    if (escaped) { escaped = false; continue }
    if (char === "\\") { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === "{") openBraces++
    if (char === "}") openBraces--
    if (char === "[") openBrackets++
    if (char === "]") openBrackets--
  }

  // Close any unclosed strings
  if (inString) repaired += '"'

  // Close unclosed brackets/braces
  while (openBrackets > 0) { repaired += "]"; openBrackets-- }
  while (openBraces > 0) { repaired += "}"; openBraces-- }

  try {
    return JSON.parse(repaired)
  } catch {
    // If repair failed, try a more aggressive approach:
    // Find the last valid array element and close there
    const lastCompleteObject = repaired.lastIndexOf("},")
    if (lastCompleteObject > 0) {
      const truncated = repaired.slice(0, lastCompleteObject + 1)
      // Re-count and close
      let ob = 0, obc = 0
      let inStr = false, esc = false
      for (const c of truncated) {
        if (esc) { esc = false; continue }
        if (c === "\\") { esc = true; continue }
        if (c === '"') { inStr = !inStr; continue }
        if (inStr) continue
        if (c === "{") ob++; if (c === "}") ob--
        if (c === "[") obc++; if (c === "]") obc--
      }
      let final = truncated
      while (obc > 0) { final += "]"; obc-- }
      while (ob > 0) { final += "}"; ob-- }
      try {
        return JSON.parse(final)
      } catch {
        // Give up
      }
    }

    throw new Error(`Could not repair truncated JSON. Length: ${text.length} chars. First 200: ${text.slice(0, 200)}`)
  }
}
