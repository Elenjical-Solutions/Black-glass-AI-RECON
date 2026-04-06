"use server"

import { db } from "@/db/db"
import {
  reconciliationRunsTable,
  reconciliationDefinitionsTable,
  uploadedFilesTable,
  fieldMappingsTable,
  explanationKeysTable,
  reconciliationResultsTable,
  resultFieldDetailsTable
} from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { ReconciliationRun } from "@/db/schema/runs-schema"
import { eq } from "drizzle-orm"
import { runReconciliation, ReconConfig } from "@/lib/recon/engine"
import { parseFile, detectFormat } from "@/lib/recon/parsers"

export async function triggerRunAction(
  cycleId: string,
  definitionId: string
): Promise<ActionState<ReconciliationRun>> {
  try {
    // Create run record with status "pending"
    const [run] = await db
      .insert(reconciliationRunsTable)
      .values({
        cycleId,
        definitionId,
        status: "pending",
        startedAt: new Date()
      })
      .returning()

    try {
      // Load definition
      const [definition] = await db
        .select()
        .from(reconciliationDefinitionsTable)
        .where(eq(reconciliationDefinitionsTable.id, definitionId))

      if (!definition) {
        throw new Error("Definition not found")
      }

      if (!definition.sourceAFileId || !definition.sourceBFileId) {
        throw new Error("Definition must have both source A and source B files")
      }

      // Load file contents
      const [fileA] = await db
        .select()
        .from(uploadedFilesTable)
        .where(eq(uploadedFilesTable.id, definition.sourceAFileId))

      const [fileB] = await db
        .select()
        .from(uploadedFilesTable)
        .where(eq(uploadedFilesTable.id, definition.sourceBFileId))

      if (!fileA?.fileContent || !fileB?.fileContent) {
        throw new Error("File contents not available")
      }

      // Load field mappings
      const mappings = await db
        .select()
        .from(fieldMappingsTable)
        .where(eq(fieldMappingsTable.definitionId, definitionId))

      // Load explanation keys for the project
      const expKeys = await db
        .select()
        .from(explanationKeysTable)
        .where(eq(explanationKeysTable.projectId, definition.projectId))

      // Parse files
      const formatA = detectFormat(fileA.filename, fileA.fileContent)
      const formatB = detectFormat(fileB.filename, fileB.fileContent)
      const parsedA = parseFile(fileA.fileContent, formatA)
      const parsedB = parseFile(fileB.fileContent, formatB)

      // Build recon config
      const keyMappings = mappings.filter(m => m.isKey)
      const keyFields = keyMappings.map(m => ({
        fieldA: m.fieldNameA,
        fieldB: m.fieldNameB
      }))

      const fieldMappingsConfig = mappings.map(m => ({
        fieldNameA: m.fieldNameA,
        fieldNameB: m.fieldNameB,
        matcherType: m.matcherType,
        tolerance: m.tolerance ? parseFloat(m.tolerance) : undefined,
        toleranceType: m.toleranceType ?? undefined
      }))

      const explanationKeyRules = expKeys.map(ek => ({
        id: ek.id,
        code: ek.code,
        label: ek.label,
        autoMatchPattern: ek.autoMatchPattern as any
      }))

      const config: ReconConfig = {
        keyFields,
        fieldMappings: fieldMappingsConfig,
        explanationKeys: explanationKeyRules
      }

      // Run reconciliation
      const output = runReconciliation(parsedA, parsedB, config)

      // Build a mapping of fieldNameA -> fieldMappingId for field details
      const fieldMappingIdMap = new Map<string, string>()
      for (const m of mappings) {
        fieldMappingIdMap.set(m.fieldNameA, m.id)
      }

      // Save results in batch
      for (const result of output.results) {
        const [savedResult] = await db
          .insert(reconciliationResultsTable)
          .values({
            runId: run.id,
            rowKeyValue: result.keyValue,
            sourceARowIndex: result.sourceARowIndex,
            sourceBRowIndex: result.sourceBRowIndex,
            status: result.status,
            explanationKeyId: result.explanationKeyId ?? null,
            aiExplanation: result.explanationReason ?? null,
            isPropagated: false
          })
          .returning()

        // Save field details for this result
        if (result.fields.length > 0) {
          const fieldDetailValues = result.fields
            .map(field => {
              const mappingId = fieldMappingIdMap.get(field.fieldNameA)
              if (!mappingId) return null

              return {
                resultId: savedResult.id,
                fieldMappingId: mappingId,
                valueA: field.valueA,
                valueB: field.valueB,
                numericDiff: field.matcherResult.numericDiff?.toString() ?? null,
                isMatch: field.isMatch,
                matcherOutput: field.matcherResult
              }
            })
            .filter(Boolean) as any[]

          if (fieldDetailValues.length > 0) {
            await db
              .insert(resultFieldDetailsTable)
              .values(fieldDetailValues)
          }
        }
      }

      // Update run status to completed with summary
      const [updatedRun] = await db
        .update(reconciliationRunsTable)
        .set({
          status: "completed",
          summary: output.summary,
          completedAt: new Date()
        })
        .where(eq(reconciliationRunsTable.id, run.id))
        .returning()

      return { status: "success", data: updatedRun }
    } catch (innerError: any) {
      // Update run status to failed
      await db
        .update(reconciliationRunsTable)
        .set({
          status: "failed",
          summary: { error: innerError.message },
          completedAt: new Date()
        })
        .where(eq(reconciliationRunsTable.id, run.id))

      return { status: "error", message: innerError.message }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getRunsForCycleAction(
  cycleId: string
): Promise<ActionState<ReconciliationRun[]>> {
  try {
    const runs = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.cycleId, cycleId))

    return { status: "success", data: runs }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getRunByIdAction(
  runId: string
): Promise<ActionState<ReconciliationRun>> {
  try {
    const [run] = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.id, runId))

    if (!run) {
      return { status: "error", message: "Run not found" }
    }

    return { status: "success", data: run }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
