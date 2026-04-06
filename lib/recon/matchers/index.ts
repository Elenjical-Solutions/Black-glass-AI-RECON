import { Matcher } from "./types"
import { TextMatcher } from "./text-matcher"
import { NumberMatcher } from "./number-matcher"
import { DateMatcher } from "./date-matcher"
import { RegexMatcher } from "./regex-matcher"

const matchers: Record<string, Matcher> = {
  text: new TextMatcher(),
  number: new NumberMatcher(),
  date: new DateMatcher(),
  regex: new RegexMatcher(),
}

export function getMatcher(type: string): Matcher {
  const matcher = matchers[type]
  if (!matcher) throw new Error(`Unknown matcher type: ${type}`)
  return matcher
}

export * from "./types"
