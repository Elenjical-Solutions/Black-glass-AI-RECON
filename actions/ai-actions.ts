"use server"

import {
  suggestFieldMappings,
  SuggestedMapping,
} from "@/lib/ai/field-mapping-suggest"
import {
  explainDifferences,
  DiffExplanation,
} from "@/lib/ai/diff-explainer"
import {
  categorizeBreaks,
  CategoryResult,
} from "@/lib/ai/auto-categorizer"
import {
  compareScreenshots,
  ScreenshotDifference,
} from "@/lib/ai/screenshot-analyzer"
import { generateSummary } from "@/lib/ai/summary-generator"
import { ActionState } from "@/types/actions-types"

export async function suggestFieldMappingsAction(
  headersA: string[],
  headersB: string[],
  sampleRowsA?: Record<string, string>[],
  sampleRowsB?: Record<string, string>[]
): Promise<ActionState<SuggestedMapping[]>> {
  try {
    const data = await suggestFieldMappings(
      headersA,
      headersB,
      sampleRowsA,
      sampleRowsB
    )
    return { status: "success", data }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function explainDifferencesAction(
  breaks: Array<{
    rowKey: string
    fieldName: string
    valueA: string
    valueB: string
    numericDiff?: number
  }>
): Promise<ActionState<DiffExplanation[]>> {
  try {
    const data = await explainDifferences(breaks)
    return { status: "success", data }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function categorizeBreaksAction(
  breaks: Array<{
    rowKey: string
    fieldName: string
    valueA: string
    valueB: string
    diff?: number
  }>
): Promise<ActionState<CategoryResult[]>> {
  try {
    const data = await categorizeBreaks(breaks)
    return { status: "success", data }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function compareScreenshotsAction(
  imageABase64: string,
  imageBBase64: string
): Promise<ActionState<ScreenshotDifference[]>> {
  try {
    const data = await compareScreenshots(imageABase64, imageBBase64)
    return { status: "success", data }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function generateSummaryAction(stats: {
  totalRows: number
  matched: number
  breaks: number
  explained: number
  unexplained: number
  topCategories: Array<{ category: string; count: number }>
  topExplanationKeys: Array<{ code: string; count: number }>
}): Promise<ActionState<string>> {
  try {
    const data = await generateSummary(stats)
    return { status: "success", data }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
