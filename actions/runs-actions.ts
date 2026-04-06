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
import { eq, inArray } from "drizzle-orm"
import { runReconciliation, ReconConfig } from "@/lib/recon/engine"
import { parseFile, detectFormat } from "@/lib/recon/parsers"
import {
  runChunkedReconciliation,
  recommendChunkSize,
  ChunkedReconConfig,
  ChunkResult
} from "@/lib/streaming/chunked-processor"

/** Threshold above which we switch from in-memory to chunked processing */
const CHUNKED_THRESHOLD = 10_000

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
      // Update status to processing
      await db
        .update(reconciliationRunsTable)
        .set({ status: "processing" })
        .where(eq(reconciliationRunsTable.id, run.id))

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

      // Build shared config pieces
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

      // Build a mapping of fieldNameA -> fieldMappingId for DB writes
      const fieldMappingIdMap = new Map<string, string>()
      for (const m of mappings) {
        fieldMappingIdMap.set(m.fieldNameA, m.id)
      }

      // Helper: persist a batch of results to DB
      async function persistResultsBatch(
        results: Array<{
          keyValue: string
          sourceARowIndex: number | null
          sourceBRowIndex: number | null
          status: string
          fields: Array<{
            fieldNameA: string
            valueA: string | null
            valueB: string | null
            isMatch: boolean
            matcherResult: { numericDiff?: number } & Record<string, unknown>
          }>
          explanationKeyId?: string
          explanationReason?: string
        }>
      ) {
        // Batch insert results (up to 500 at a time for Postgres param limits)
        const BATCH_SIZE = 500
        for (let i = 0; i < results.length; i += BATCH_SIZE) {
          const batch = results.slice(i, i + BATCH_SIZE)
          const insertedResults = await db
            .insert(reconciliationResultsTable)
            .values(
              batch.map(result => ({
                runId: run.id,
                rowKeyValue: result.keyValue,
                sourceARowIndex: result.sourceARowIndex,
                sourceBRowIndex: result.sourceBRowIndex,
                status: result.status,
                explanationKeyId: result.explanationKeyId ?? null,
                aiExplanation: result.explanationReason ?? null,
                isPropagated: false
              }))
            )
            .returning({ id: reconciliationResultsTable.id })

          // Collect all field details for this batch
          const allFieldDetails: Array<{
            resultId: string
            fieldMappingId: string
            valueA: string | null
            valueB: string | null
            numericDiff: string | null
            isMatch: boolean
            matcherOutput: unknown
          }> = []

          for (let j = 0; j < batch.length; j++) {
            const result = batch[j]
            const savedId = insertedResults[j]?.id
            if (!savedId || result.fields.length === 0) continue

            for (const field of result.fields) {
              const mappingId = fieldMappingIdMap.get(field.fieldNameA)
              if (!mappingId) continue
              allFieldDetails.push({
                resultId: savedId,
                fieldMappingId: mappingId,
                valueA: field.valueA,
                valueB: field.valueB,
                numericDiff: field.matcherResult.numericDiff?.toString() ?? null,
                isMatch: field.isMatch,
                matcherOutput: field.matcherResult
              })
            }
          }

          if (allFieldDetails.length > 0) {
            // Insert field details in sub-batches too
            for (let k = 0; k < allFieldDetails.length; k += BATCH_SIZE) {
              await db
                .insert(resultFieldDetailsTable)
                .values(allFieldDetails.slice(k, k + BATCH_SIZE) as any[])
            }
          }
        }
      }

      const totalRows = Math.max(parsedA.totalRows, parsedB.totalRows)
      const useChunked = totalRows > CHUNKED_THRESHOLD

      if (useChunked) {
        // ── Chunked processing for large files ─────────────────────────
        const chunkSize = recommendChunkSize(
          totalRows,
          parsedA.headers.length
        )

        const chunkedConfig: ChunkedReconConfig = {
          keyFields,
          fieldMappings: fieldMappingsConfig,
          explanationKeys: explanationKeyRules,
          chunkSize
        }

        const onChunkComplete = async (chunk: ChunkResult) => {
          await persistResultsBatch(chunk.results as any[])
        }

        const summary = await runChunkedReconciliation(
          parsedA,
          parsedB,
          chunkedConfig,
          onChunkComplete
        )

        const [updatedRun] = await db
          .update(reconciliationRunsTable)
          .set({
            status: "completed",
            summary: {
              ...summary,
              mode: "chunked",
              chunkSize
            },
            completedAt: new Date()
          })
          .where(eq(reconciliationRunsTable.id, run.id))
          .returning()

        return { status: "success", data: updatedRun }
      } else {
        // ── In-memory processing for smaller files ─────────────────────
        const config: ReconConfig = {
          keyFields,
          fieldMappings: fieldMappingsConfig,
          explanationKeys: explanationKeyRules
        }

        const output = runReconciliation(parsedA, parsedB, config)

        await persistResultsBatch(output.results as any[])

        const [updatedRun] = await db
          .update(reconciliationRunsTable)
          .set({
            status: "completed",
            summary: { ...output.summary, mode: "in-memory" },
            completedAt: new Date()
          })
          .where(eq(reconciliationRunsTable.id, run.id))
          .returning()

        return { status: "success", data: updatedRun }
      }
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

/**
 * Get a run with full context: definition name, category, department,
 * source file names, and field mapping names (instead of just IDs).
 */
export async function getRunWithContextAction(
  runId: string
): Promise<ActionState<{
  run: ReconciliationRun
  definition: {
    id: string; name: string; description: string | null;
    category: string | null; department: string | null;
  }
  fileA: { id: string; filename: string; rowCount: number | null } | null
  fileB: { id: string; filename: string; rowCount: number | null } | null
  fieldMappingNames: Record<string, string> // mappingId -> fieldNameA
}>> {
  try {
    const [run] = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.id, runId))

    if (!run) {
      return { status: "error", message: "Run not found" }
    }

    const [definition] = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, run.definitionId))

    if (!definition) {
      return { status: "error", message: "Definition not found" }
    }

    let fileA = null
    let fileB = null

    if (definition.sourceAFileId) {
      const [f] = await db.select({
        id: uploadedFilesTable.id,
        filename: uploadedFilesTable.filename,
        rowCount: uploadedFilesTable.rowCount,
      }).from(uploadedFilesTable).where(eq(uploadedFilesTable.id, definition.sourceAFileId))
      fileA = f ?? null
    }

    if (definition.sourceBFileId) {
      const [f] = await db.select({
        id: uploadedFilesTable.id,
        filename: uploadedFilesTable.filename,
        rowCount: uploadedFilesTable.rowCount,
      }).from(uploadedFilesTable).where(eq(uploadedFilesTable.id, definition.sourceBFileId))
      fileB = f ?? null
    }

    // Get field mapping names so we can display them instead of IDs in results
    const mappings = await db
      .select({ id: fieldMappingsTable.id, fieldNameA: fieldMappingsTable.fieldNameA })
      .from(fieldMappingsTable)
      .where(eq(fieldMappingsTable.definitionId, definition.id))

    const fieldMappingNames: Record<string, string> = {}
    for (const m of mappings) {
      fieldMappingNames[m.id] = m.fieldNameA
    }

    return {
      status: "success",
      data: {
        run,
        definition: {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          category: (definition as any).category ?? null,
          department: (definition as any).department ?? null,
        },
        fileA,
        fileB,
        fieldMappingNames,
      }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

/**
 * Get runs for a cycle with definition context (name, category, department, file names).
 */
export async function getRunsWithContextForCycleAction(
  cycleId: string
): Promise<ActionState<Array<ReconciliationRun & {
  definitionName: string; category: string | null; department: string | null;
  fileAName: string | null; fileBName: string | null;
}>>> {
  try {
    const runs = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.cycleId, cycleId))

    // Load all definitions referenced by these runs
    const defIds = [...new Set(runs.map(r => r.definitionId))]
    const definitions = defIds.length > 0
      ? await db.select().from(reconciliationDefinitionsTable).where(
          inArray(reconciliationDefinitionsTable.id, defIds)
        )
      : []

    // Load all files referenced by definitions
    const fileIds = definitions.flatMap(d => [d.sourceAFileId, d.sourceBFileId]).filter(Boolean) as string[]
    const files = fileIds.length > 0
      ? await db.select({ id: uploadedFilesTable.id, filename: uploadedFilesTable.filename })
          .from(uploadedFilesTable)
          .where(inArray(uploadedFilesTable.id, fileIds))
      : []

    const defMap = new Map(definitions.map(d => [d.id, d]))
    const fileMap = new Map(files.map(f => [f.id, f.filename]))

    const enriched = runs.map((run, index) => {
      const def = defMap.get(run.definitionId)
      return {
        ...run,
        definitionName: def?.name ?? "Unknown Definition",
        category: (def as any)?.category ?? null,
        department: (def as any)?.department ?? null,
        fileAName: def?.sourceAFileId ? (fileMap.get(def.sourceAFileId) ?? null) : null,
        fileBName: def?.sourceBFileId ? (fileMap.get(def.sourceBFileId) ?? null) : null,
      }
    })

    // Sort: core first, then sensitivity, then downstream
    const catOrder: Record<string, number> = { core: 0, sensitivity: 1, downstream: 2 }
    enriched.sort((a, b) => {
      const aOrder = catOrder[a.category ?? "downstream"] ?? 2
      const bOrder = catOrder[b.category ?? "downstream"] ?? 2
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.definitionName.localeCompare(b.definitionName)
    })

    return { status: "success", data: enriched }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
