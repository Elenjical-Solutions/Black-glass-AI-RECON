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
import { getAIClient, DEFAULT_MODEL } from "@/lib/ai/client"
import { parseJsonFromResponse } from "@/lib/ai/utils"
import { db } from "@/db/db"
import {
  reconciliationResultsTable,
  resultFieldDetailsTable,
  explanationKeysTable,
  reconciliationRunsTable,
  reconciliationDefinitionsTable,
  fieldMappingsTable,
  resultExplanationKeysTable,
} from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"

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

// ---------------------------------------------------------------------------
// 1. analyzeBreakPatternsAction
// ---------------------------------------------------------------------------

interface BreakCluster {
  name: string
  description: string
  tradeCount: number
  tradeIds: string[]
  suggestedKeyCode: string
  confidence: number
  avgDiff: number
}

interface BreakAnomaly {
  tradeId: string
  reason: string
  severity: string
}

interface BreakPatternAnalysis {
  clusters: BreakCluster[]
  anomalies: BreakAnomaly[]
  summary: string
  totalBreaksAnalyzed: number
}

export async function analyzeBreakPatternsAction(
  runId: string
): Promise<ActionState<BreakPatternAnalysis>> {
  try {
    // Load the run and its definition for context
    const run = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.id, runId))
      .then(rows => rows[0])

    if (!run) {
      return { status: "error", message: "Run not found" }
    }

    const definition = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, run.definitionId))
      .then(rows => rows[0])

    // Load all break results for this run
    let breakResults = await db
      .select()
      .from(reconciliationResultsTable)
      .where(
        and(
          eq(reconciliationResultsTable.runId, runId),
          eq(reconciliationResultsTable.status, "break")
        )
      )

    const totalBreaks = breakResults.length

    if (totalBreaks === 0) {
      return {
        status: "success",
        data: {
          clusters: [],
          anomalies: [],
          summary: "No breaks found for this run.",
          totalBreaksAnalyzed: 0,
        },
      }
    }

    // Sample if more than 200 breaks — spread across asset classes
    if (breakResults.length > 200) {
      // Group by rowKeyValue prefix to get diversity, then take evenly
      const step = Math.floor(breakResults.length / 200)
      breakResults = breakResults.filter((_, i) => i % step === 0).slice(0, 200)
    }

    // Batch-load field details for the sampled break results
    const breakResultIds = breakResults.map(r => r.id)
    const fieldDetails = await db
      .select()
      .from(resultFieldDetailsTable)
      .where(inArray(resultFieldDetailsTable.resultId, breakResultIds))

    // Load field mappings for human-readable field names
    const fieldMappings = definition
      ? await db
          .select()
          .from(fieldMappingsTable)
          .where(eq(fieldMappingsTable.definitionId, definition.id))
      : []

    const fieldMappingLookup = new Map(
      fieldMappings.map(fm => [fm.id, fm])
    )

    // Group field details by resultId
    const detailsByResult = new Map<string, typeof fieldDetails>()
    for (const fd of fieldDetails) {
      const list = detailsByResult.get(fd.resultId) ?? []
      list.push(fd)
      detailsByResult.set(fd.resultId, list)
    }

    // Load explanation keys for the project
    const projectId = definition?.projectId
    const explanationKeys = projectId
      ? await db
          .select()
          .from(explanationKeysTable)
          .where(eq(explanationKeysTable.projectId, projectId))
      : []

    // Load total trade count from the run (all results, not just breaks)
    const allResults = await db
      .select()
      .from(reconciliationResultsTable)
      .where(eq(reconciliationResultsTable.runId, runId))

    const totalTrades = allResults.length

    // Build the structured data for AI
    const breaksForAI = breakResults.map(r => {
      const details = detailsByResult.get(r.id) ?? []
      return {
        trade_id: r.rowKeyValue,
        typology: r.aiCategory ?? "unknown",
        asset_class: definition?.category ?? "unknown",
        currency: "N/A",
        fieldDiffs: details.map(d => {
          const mapping = fieldMappingLookup.get(d.fieldMappingId)
          return {
            fieldName: mapping
              ? `${mapping.fieldNameA} / ${mapping.fieldNameB}`
              : d.fieldMappingId,
            valueA: d.valueA,
            valueB: d.valueB,
            numericDiff: d.numericDiff ? Number(d.numericDiff) : null,
          }
        }),
      }
    })

    const keysForAI = explanationKeys.map(k => ({
      code: k.code,
      label: k.label,
      description: k.description,
    }))

    const systemPrompt =
      "You are a senior financial reconciliation analyst specializing in trading system upgrades (e.g., Murex MX.3). " +
      "Your task is PURE PATTERN DISCOVERY — analyze ALL breaks to identify CLUSTERS of similar differences. " +
      "Do NOT assign explanation keys or suggest root causes yet. Just describe what you observe.\n\n" +
      "For each cluster you MUST provide:\n" +
      "- name: short descriptive cluster label based on what you observe (e.g., 'IR DV01 Shift Group', 'Sub-Cent Rounding Group')\n" +
      "- description: 2-3 sentences describing the observable pattern — which fields changed, by how much, on what products. Do NOT speculate on the root cause.\n" +
      "- tradeCount: number of trades in this cluster\n" +
      "- tradeIds: array of trade IDs in this cluster\n" +
      "- avgDiff: average numeric difference across the key differentiating field\n" +
      "- fieldEvidence: array of per-field observations, each with:\n" +
      "  - fieldName: the column name\n" +
      "  - observation: what you observe (e.g., 'dv01_par shifted by 2-5% consistently across all trades in this group')\n" +
      "  - direction: 'increased' | 'decreased' | 'mixed' | 'unchanged'\n" +
      "  - avgMagnitude: average absolute change in this field\n" +
      "  - isKeyDriver: boolean — is this the primary field differentiating this cluster?\n\n" +
      "Flag any ANOMALIES — breaks that don't fit into any cluster. For anomalies, explain per-field why they are unusual.\n\n" +
      "Return JSON: {\n" +
      '  "clusters": [{ "name", "description", "tradeCount", "tradeIds", "avgDiff", ' +
      '"fieldEvidence": [{ "fieldName", "observation", "direction", "avgMagnitude", "isKeyDriver" }] }],\n' +
      '  "anomalies": [{ "tradeId", "reason", "severity", "fieldDetails": [{ "fieldName", "valueA", "valueB", "observation" }] }],\n' +
      '  "summary": string — overall summary of what patterns you found, how many breaks are clustered vs unclustered\n}'

    const userMessage =
      `Reconciliation: ${definition?.name ?? "Unknown"}\n` +
      `Category: ${definition?.category ?? "N/A"}\n` +
      `Total trades: ${totalTrades}, Total breaks: ${totalBreaks}, ` +
      `Breaks analyzed: ${breakResults.length}\n\n` +
      `Break details:\n${JSON.stringify(breaksForAI, null, 2)}`

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = parseJsonFromResponse(text)

    return {
      status: "success",
      data: {
        clusters: parsed.clusters ?? [],
        anomalies: parsed.anomalies ?? [],
        summary: parsed.summary ?? "",
        totalBreaksAnalyzed: breakResults.length,
      },
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// 2. suggestDependenciesAction
// ---------------------------------------------------------------------------

interface DependencySuggestion {
  definitionId: string
  definitionName: string
  confidence: number
  reason: string
  sharedColumns: string[]
}

export async function suggestDependenciesAction(
  definitionId: string,
  projectId: string
): Promise<ActionState<{ suggestions: DependencySuggestion[] }>> {
  try {
    // Load the target definition's field mappings
    const targetMappings = await db
      .select()
      .from(fieldMappingsTable)
      .where(eq(fieldMappingsTable.definitionId, definitionId))

    const targetDefinition = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, definitionId))
      .then(rows => rows[0])

    if (!targetDefinition) {
      return { status: "error", message: "Definition not found" }
    }

    // Load all OTHER definitions in the project
    const allDefinitions = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.projectId, projectId))

    const otherDefinitions = allDefinitions.filter(d => d.id !== definitionId)

    if (otherDefinitions.length === 0) {
      return {
        status: "success",
        data: { suggestions: [] },
      }
    }

    // Batch-load field mappings for all other definitions
    const otherDefIds = otherDefinitions.map(d => d.id)
    const otherMappings = await db
      .select()
      .from(fieldMappingsTable)
      .where(inArray(fieldMappingsTable.definitionId, otherDefIds))

    // Group mappings by definition
    const mappingsByDef = new Map<string, typeof otherMappings>()
    for (const m of otherMappings) {
      const list = mappingsByDef.get(m.definitionId) ?? []
      list.push(m)
      mappingsByDef.set(m.definitionId, list)
    }

    const targetColumns = targetMappings.map(m => m.fieldNameA)

    const otherDefsForAI = otherDefinitions.map(d => ({
      definitionId: d.id,
      name: d.name,
      category: d.category,
      columns: (mappingsByDef.get(d.id) ?? []).map(m => m.fieldNameA),
    }))

    const systemPrompt =
      "You are a financial reconciliation dependency analyst. " +
      "Given a downstream reconciliation report and existing definitions, suggest which definitions " +
      "this report likely depends on for explanation propagation. Consider: if a column appears in both " +
      "a core/sensitivity recon and this downstream report, there's likely a dependency. " +
      'Return JSON: { "suggestions": [{ "definitionId": string, "definitionName": string, ' +
      '"confidence": number, "reason": string, "sharedColumns": string[] }] }'

    const userMessage =
      `Target definition: "${targetDefinition.name}" (category: ${targetDefinition.category ?? "N/A"})\n` +
      `Target columns: ${JSON.stringify(targetColumns)}\n\n` +
      `Existing definitions in the project:\n${JSON.stringify(otherDefsForAI, null, 2)}`

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = parseJsonFromResponse(text)

    return {
      status: "success",
      data: { suggestions: parsed.suggestions ?? [] },
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// 3. suggestExplanationKeyAction
// ---------------------------------------------------------------------------

interface KeySuggestionAlternative {
  code: string
  confidence: number
  reason: string
}

interface KeySuggestionResult {
  suggestedKeyCode: string
  confidence: number
  reasoning: string
  alternatives: KeySuggestionAlternative[]
}

export async function suggestExplanationKeyAction(
  resultId: string,
  projectId: string
): Promise<ActionState<KeySuggestionResult>> {
  try {
    // Load the result
    const result = await db
      .select()
      .from(reconciliationResultsTable)
      .where(eq(reconciliationResultsTable.id, resultId))
      .then(rows => rows[0])

    if (!result) {
      return { status: "error", message: "Result not found" }
    }

    // Load field details for this result
    const fieldDetails = await db
      .select()
      .from(resultFieldDetailsTable)
      .where(eq(resultFieldDetailsTable.resultId, resultId))

    // Load the run and definition for context
    const run = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.id, result.runId))
      .then(rows => rows[0])

    const definition = run
      ? await db
          .select()
          .from(reconciliationDefinitionsTable)
          .where(eq(reconciliationDefinitionsTable.id, run.definitionId))
          .then(rows => rows[0])
      : null

    // Load field mappings for human-readable names
    const fieldMappingIds = fieldDetails.map(fd => fd.fieldMappingId)
    const fieldMappings =
      fieldMappingIds.length > 0
        ? await db
            .select()
            .from(fieldMappingsTable)
            .where(inArray(fieldMappingsTable.id, fieldMappingIds))
        : []

    const fieldMappingLookup = new Map(
      fieldMappings.map(fm => [fm.id, fm])
    )

    // Load explanation keys
    const explanationKeys = await db
      .select()
      .from(explanationKeysTable)
      .where(eq(explanationKeysTable.projectId, projectId))

    if (explanationKeys.length === 0) {
      return {
        status: "error",
        message: "No explanation keys configured for this project",
      }
    }

    const diffsForAI = fieldDetails.map(d => {
      const mapping = fieldMappingLookup.get(d.fieldMappingId)
      return {
        fieldName: mapping
          ? `${mapping.fieldNameA} / ${mapping.fieldNameB}`
          : d.fieldMappingId,
        valueA: d.valueA,
        valueB: d.valueB,
        numericDiff: d.numericDiff ? Number(d.numericDiff) : null,
        isMatch: d.isMatch,
      }
    })

    const keysForAI = explanationKeys.map(k => ({
      code: k.code,
      label: k.label,
      description: k.description,
    }))

    const systemPrompt =
      "You are analyzing a single reconciliation break. Given the field differences, product type, " +
      "and available explanation keys, suggest which key best explains this break and why. " +
      "Consider: the magnitude of diffs, which fields changed, the product type. " +
      'Return JSON: { "suggestedKeyCode": string, "confidence": number, "reasoning": string, ' +
      '"alternativeKeyCodes": [{ "code": string, "confidence": number, "reason": string }] }'

    const userMessage =
      `Trade ID: ${result.rowKeyValue}\n` +
      `Definition: ${definition?.name ?? "Unknown"}\n` +
      `Category: ${definition?.category ?? "N/A"}\n` +
      `Current AI category: ${result.aiCategory ?? "N/A"}\n\n` +
      `Field differences:\n${JSON.stringify(diffsForAI, null, 2)}\n\n` +
      `Available explanation keys:\n${JSON.stringify(keysForAI, null, 2)}`

    const client = getAIClient()
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = parseJsonFromResponse(text)

    return {
      status: "success",
      data: {
        suggestedKeyCode: parsed.suggestedKeyCode,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        alternatives: parsed.alternativeKeyCodes ?? [],
      },
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// 4. applyBreakAnalysisSuggestionsAction
// ---------------------------------------------------------------------------

export async function applyBreakAnalysisSuggestionsAction(
  runId: string,
  clusters: Array<{ tradeIds: string[]; suggestedKeyCode: string }>
): Promise<ActionState<{ updatedCount: number }>> {
  try {
    // Load the run to get the project context
    const run = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.id, runId))
      .then(rows => rows[0])

    if (!run) {
      return { status: "error", message: "Run not found" }
    }

    const definition = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, run.definitionId))
      .then(rows => rows[0])

    if (!definition) {
      return { status: "error", message: "Definition not found" }
    }

    // Load all explanation keys for the project to look up by code
    const explanationKeys = await db
      .select()
      .from(explanationKeysTable)
      .where(eq(explanationKeysTable.projectId, definition.projectId))

    const keyByCode = new Map(explanationKeys.map(k => [k.code, k]))

    let updatedCount = 0

    for (const cluster of clusters) {
      const key = keyByCode.get(cluster.suggestedKeyCode)
      if (!key) {
        console.warn(
          `Explanation key not found for code: ${cluster.suggestedKeyCode}`
        )
        continue
      }

      if (cluster.tradeIds.length === 0) continue

      // Find results matching these trade IDs (rowKeyValue) in this run
      const matchingResults = await db
        .select({ id: reconciliationResultsTable.id })
        .from(reconciliationResultsTable)
        .where(
          and(
            eq(reconciliationResultsTable.runId, runId),
            inArray(reconciliationResultsTable.rowKeyValue, cluster.tradeIds)
          )
        )

      if (matchingResults.length === 0) continue

      const resultIds = matchingResults.map(r => r.id)

      // Update in batch
      await db
        .update(reconciliationResultsTable)
        .set({ explanationKeyId: key.id })
        .where(inArray(reconciliationResultsTable.id, resultIds))

      updatedCount += resultIds.length
    }

    return {
      status: "success",
      data: { updatedCount },
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// 5. AI Natural Language Rule Assignment (multi-key)
// ---------------------------------------------------------------------------

interface NLRAssignment {
  tradeId: string
  resultId: string
  assignments: Array<{
    keyCode: string
    confidence: number
    reasoning: string
  }>
}

interface NLRAssignmentResult {
  assignments: NLRAssignment[]
  summary: string
  totalAssigned: number
  totalBreaksProcessed: number
}

/**
 * Read all explanation keys' natural language rules, analyze breaks,
 * and assign MULTIPLE keys per break based on the NL rules.
 * Each assignment includes confidence and per-field reasoning.
 */
export async function aiAssignByNaturalLanguageRulesAction(
  runId: string
): Promise<ActionState<NLRAssignmentResult>> {
  try {
    const run = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.id, runId))
      .then(rows => rows[0])

    if (!run) return { status: "error", message: "Run not found" }

    const definition = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, run.definitionId))
      .then(rows => rows[0])

    // Load breaks
    let breakResults = await db
      .select()
      .from(reconciliationResultsTable)
      .where(
        and(
          eq(reconciliationResultsTable.runId, runId),
          eq(reconciliationResultsTable.status, "break")
        )
      )

    if (breakResults.length === 0) {
      return {
        status: "success",
        data: { assignments: [], summary: "No breaks to analyze.", totalAssigned: 0, totalBreaksProcessed: 0 }
      }
    }

    // Sample if too many
    const totalBreaks = breakResults.length
    if (breakResults.length > 150) {
      const step = Math.floor(breakResults.length / 150)
      breakResults = breakResults.filter((_, i) => i % step === 0).slice(0, 150)
    }

    // Load field details
    const breakIds = breakResults.map(r => r.id)
    const fieldDetails = await db
      .select()
      .from(resultFieldDetailsTable)
      .where(inArray(resultFieldDetailsTable.resultId, breakIds))

    // Load field mapping names
    const fieldMappings = definition
      ? await db.select().from(fieldMappingsTable).where(eq(fieldMappingsTable.definitionId, definition.id))
      : []
    const fmLookup = new Map(fieldMappings.map(fm => [fm.id, fm]))

    const detailsByResult = new Map<string, typeof fieldDetails>()
    for (const fd of fieldDetails) {
      const list = detailsByResult.get(fd.resultId) ?? []
      list.push(fd)
      detailsByResult.set(fd.resultId, list)
    }

    // Load explanation keys WITH natural language rules
    const projectId = definition?.projectId
    const keys = projectId
      ? await db.select().from(explanationKeysTable).where(eq(explanationKeysTable.projectId, projectId))
      : []

    const keysWithRules = keys.filter(k => k.naturalLanguageRule)

    if (keysWithRules.length === 0) {
      return {
        status: "error",
        message: "No explanation keys have natural language rules defined. Add rules to your keys first."
      }
    }

    // Build break data for AI
    const breaksForAI = breakResults.map(r => {
      const details = detailsByResult.get(r.id) ?? []
      return {
        resultId: r.id,
        trade_id: r.rowKeyValue,
        fieldDiffs: details.map(d => {
          const mapping = fmLookup.get(d.fieldMappingId)
          return {
            fieldName: mapping?.fieldNameA ?? d.fieldMappingId,
            valueA: d.valueA,
            valueB: d.valueB,
            numericDiff: d.numericDiff ? Number(d.numericDiff) : null,
            isMatch: d.isMatch,
          }
        }).filter(d => !d.isMatch), // Only send non-matching fields
      }
    })

    // Build key rules for AI
    const keyRulesForAI = keysWithRules.map(k => ({
      code: k.code,
      label: k.label,
      rule: k.naturalLanguageRule,
    }))

    const systemPrompt =
      "You are a senior financial reconciliation analyst. You are given:\n" +
      "1. A set of explanation keys, each with a NATURAL LANGUAGE RULE.\n" +
      "2. A set of reconciliation breaks with field differences.\n\n" +
      "For each break, assign EVERY key whose rule matches. A break CAN have multiple keys.\n\n" +
      "For each assignment provide:\n" +
      "- keyCode: the key code\n" +
      "- confidence: 0-100\n" +
      "- reasoning: ONE sentence explaining why (reference specific field names and diff values)\n\n" +
      "IMPORTANT: Keep reasoning to ONE concise sentence per assignment. Do NOT include breaks with no matching keys.\n\n" +
      'Return JSON: { "assignments": [{ "trade_id": "...", "keys": [{ "keyCode": "...", "confidence": 85, "reasoning": "..." }] }] }'

    const client = getAIClient()
    const resultIdByTradeId = new Map(breakResults.map(r => [r.rowKeyValue, r.id]))
    const keyIdByCode = new Map(keys.map(k => [k.code, k.id]))

    // Process in batches of 20 breaks to avoid token limit issues
    const BATCH_SIZE = 20
    const allParsedAssignments: Array<{ trade_id: string; keys: Array<{ keyCode: string; confidence: number; reasoning: string }> }> = []

    for (let batchStart = 0; batchStart < breaksForAI.length; batchStart += BATCH_SIZE) {
      const batch = breaksForAI.slice(batchStart, batchStart + BATCH_SIZE)

      const userMessage =
        `Reconciliation: ${definition?.name ?? "Unknown"}\n` +
        `Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(breaksForAI.length / BATCH_SIZE)}, ` +
        `${batch.length} breaks\n\n` +
        `=== RULES ===\n${keyRulesForAI.map(k => `[${k.code}] ${k.label}: ${k.rule}`).join("\n")}\n\n` +
        `=== BREAKS ===\n${JSON.stringify(batch)}`

      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      })

      const text = response.content[0].type === "text" ? response.content[0].text : ""
      try {
        const parsed = parseJsonFromResponse(text)
        if (parsed.assignments) {
          allParsedAssignments.push(...parsed.assignments)
        }
      } catch (parseErr: any) {
        console.error(`NLR batch ${batchStart / BATCH_SIZE + 1} parse error:`, parseErr.message)
        // Continue with other batches even if one fails
      }
    }

    // Insert assignments into junction table
    let totalAssigned = 0
    const nlrAssignments: NLRAssignment[] = []

    for (const item of allParsedAssignments) {
      const resultId = resultIdByTradeId.get(item.trade_id)
      if (!resultId) continue

      const assignments: NLRAssignment["assignments"] = []
      for (const key of (item.keys ?? [])) {
        const keyId = keyIdByCode.get(key.keyCode)
        if (!keyId) continue

        await db.insert(resultExplanationKeysTable).values({
          resultId,
          explanationKeyId: keyId,
          assignedBy: "ai_nlr",
          confidence: key.confidence ?? null,
          reasoning: key.reasoning ?? null,
        })

        assignments.push({
          keyCode: key.keyCode,
          confidence: key.confidence ?? 0,
          reasoning: key.reasoning ?? "",
        })
        totalAssigned++
      }

      // Also update the legacy single-key field (first key) for backward compatibility
      if (assignments.length > 0) {
        const primaryKeyId = keyIdByCode.get(assignments[0].keyCode)
        if (primaryKeyId) {
          await db
            .update(reconciliationResultsTable)
            .set({
              explanationKeyId: primaryKeyId,
              aiExplanation: assignments.map(a => `[${a.keyCode}:${a.confidence}%] ${a.reasoning}`).join("\n\n"),
            })
            .where(eq(reconciliationResultsTable.id, resultId))
        }
      }

      nlrAssignments.push({
        tradeId: item.trade_id,
        resultId,
        assignments,
      })
    }

    // Update the run summary with new explained count
    const explainedCount = await db
      .select()
      .from(reconciliationResultsTable)
      .where(
        and(
          eq(reconciliationResultsTable.runId, runId),
          eq(reconciliationResultsTable.status, "break")
        )
      )
      .then(rows => rows.filter(r => r.explanationKeyId !== null).length)

    const currentSummary = (run.summary as any) ?? {}
    await db
      .update(reconciliationRunsTable)
      .set({
        summary: {
          ...currentSummary,
          explained: explainedCount,
          unexplained: (currentSummary.breaks ?? totalBreaks) - explainedCount,
        }
      })
      .where(eq(reconciliationRunsTable.id, runId))

    return {
      status: "success",
      data: {
        assignments: nlrAssignments,
        summary: `Assigned ${totalAssigned} keys across ${nlrAssignments.length} breaks using natural language rules (${Math.ceil(breaksForAI.length / BATCH_SIZE)} batches).`,
        totalAssigned,
        totalBreaksProcessed: breakResults.length,
      }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
