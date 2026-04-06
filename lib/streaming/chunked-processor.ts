import { ParsedFile, ParsedRow } from "@/lib/recon/parsers/types"
import { matchRows, KeyFieldPair } from "@/lib/recon/row-matcher"
import {
  compareFields,
  FieldMapping,
  FieldComparisonResult
} from "@/lib/recon/field-comparator"
import {
  applyExplanationKeys,
  ExplanationKeyRule,
  AppliedExplanation
} from "@/lib/recon/explanation-applier"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkedReconConfig {
  keyFields: KeyFieldPair[]
  fieldMappings: FieldMapping[]
  explanationKeys: ExplanationKeyRule[]
  chunkSize: number // rows per chunk (default 5000)
}

export interface ChunkResult {
  chunkIndex: number
  results: ChunkedResultRow[]
  processedRows: number
  totalProcessedSoFar: number
}

export interface ChunkedResultRow {
  keyValue: string
  sourceARowIndex: number | null
  sourceBRowIndex: number | null
  status: "match" | "break" | "missing_a" | "missing_b"
  fields: FieldComparisonResult[]
  explanationKeyId?: string
  explanationKeyCode?: string
  explanationReason?: string
}

export interface ChunkedReconSummary {
  totalRows: number
  matched: number
  breaks: number
  missingA: number
  missingB: number
  explained: number
  unexplained: number
  chunksProcessed: number
  processingTimeMs: number
}

export type OnChunkComplete = (chunk: ChunkResult) => Promise<void>
export type OnProgress = (progress: {
  phase: "indexing" | "comparing" | "orphans" | "complete"
  processed: number
  total: number
  chunkIndex?: number
  elapsedMs: number
}) => void

// ---------------------------------------------------------------------------
// Chunked Reconciliation Engine
// ---------------------------------------------------------------------------

/**
 * Process a reconciliation in chunks for memory-efficient handling of large
 * files. File A is fully indexed in memory (hash map for O(1) key lookups),
 * then File B is processed in chunks of `chunkSize` rows. After each chunk,
 * `onChunkComplete` is called so the caller can persist results to DB.
 *
 * For most financial data (≤50 columns), 5 000 rows / chunk is the sweet spot:
 *   – ~4 MB per chunk (small enough for a single DB transaction)
 *   – ~20 chunks for a 100 K-row file (low overhead)
 */
export async function runChunkedReconciliation(
  fileA: ParsedFile,
  fileB: ParsedFile,
  config: ChunkedReconConfig,
  onChunkComplete: OnChunkComplete,
  onProgress?: OnProgress
): Promise<ChunkedReconSummary> {
  const startTime = Date.now()
  const elapsed = () => Date.now() - startTime

  const { keyFields, fieldMappings, explanationKeys, chunkSize } = config
  const fieldsA = keyFields.map((kf) => kf.fieldA)
  const fieldsB = keyFields.map((kf) => kf.fieldB)

  // ── Phase 1: Index File A ────────────────────────────────────────────
  onProgress?.({
    phase: "indexing",
    processed: 0,
    total: fileA.totalRows,
    elapsedMs: elapsed()
  })

  const indexA = new Map<string, ParsedRow>()
  for (const row of fileA.rows) {
    const key = fieldsA.map((f) => row.data[f] ?? "").join("|")
    indexA.set(key, row)
  }

  onProgress?.({
    phase: "indexing",
    processed: fileA.totalRows,
    total: fileA.totalRows,
    elapsedMs: elapsed()
  })

  // ── Phase 2: Process File B in chunks ────────────────────────────────
  let totalProcessed = 0
  let chunkIndex = 0
  const summary: ChunkedReconSummary = {
    totalRows: 0,
    matched: 0,
    breaks: 0,
    missingA: 0,
    missingB: 0,
    explained: 0,
    unexplained: 0,
    chunksProcessed: 0,
    processingTimeMs: 0
  }

  const totalB = fileB.rows.length

  for (let offset = 0; offset < totalB; offset += chunkSize) {
    const chunkRows = fileB.rows.slice(offset, offset + chunkSize)
    const chunkResults: ChunkedResultRow[] = []

    for (const rowB of chunkRows) {
      const key = fieldsB.map((f) => rowB.data[f] ?? "").join("|")
      const rowA = indexA.get(key)

      if (rowA) {
        // Matched pair – compare fields
        const fieldResults = compareFields(rowA.data, rowB.data, fieldMappings)
        const allMatch = fieldResults.every((f) => f.isMatch)

        chunkResults.push({
          keyValue: key,
          sourceARowIndex: rowA.index,
          sourceBRowIndex: rowB.index,
          status: allMatch ? "match" : "break",
          fields: fieldResults
        })

        // Remove from index so we can find orphan-A rows later
        indexA.delete(key)
      } else {
        // In B but not in A
        chunkResults.push({
          keyValue: key,
          sourceARowIndex: null,
          sourceBRowIndex: rowB.index,
          status: "missing_a",
          fields: []
        })
      }
    }

    // Apply explanation keys to break results in this chunk
    const breakResults = chunkResults
      .filter((r) => r.status === "break")
      .map((r, _i) => ({
        index: chunkResults.indexOf(r),
        status: r.status,
        fields: r.fields.map((f) => ({
          fieldNameA: f.fieldNameA,
          valueA: f.valueA,
          valueB: f.valueB,
          numericDiff: f.matcherResult.numericDiff,
          isMatch: f.isMatch
        }))
      }))

    const applied: AppliedExplanation[] = applyExplanationKeys(
      breakResults,
      explanationKeys
    )

    for (const explanation of applied) {
      const result = chunkResults[explanation.resultIndex]
      if (result) {
        result.explanationKeyId = explanation.explanationKeyId
        result.explanationKeyCode = explanation.explanationKeyCode
        result.explanationReason = explanation.reason
      }
    }

    // Accumulate summary counts
    for (const r of chunkResults) {
      summary.totalRows++
      if (r.status === "match") summary.matched++
      else if (r.status === "break") {
        summary.breaks++
        if (r.explanationKeyId) summary.explained++
        else summary.unexplained++
      } else if (r.status === "missing_a") summary.missingA++
      else if (r.status === "missing_b") summary.missingB++
    }

    totalProcessed += chunkRows.length

    // Emit chunk to caller for DB persistence
    await onChunkComplete({
      chunkIndex,
      results: chunkResults,
      processedRows: chunkRows.length,
      totalProcessedSoFar: totalProcessed
    })

    onProgress?.({
      phase: "comparing",
      processed: totalProcessed,
      total: totalB,
      chunkIndex,
      elapsedMs: elapsed()
    })

    chunkIndex++
  }

  // ── Phase 3: Orphan rows (in A but not in B) ────────────────────────
  onProgress?.({
    phase: "orphans",
    processed: 0,
    total: indexA.size,
    elapsedMs: elapsed()
  })

  // Process remaining A rows (not matched) in chunks too
  const orphanRows = Array.from(indexA.values())
  for (let offset = 0; offset < orphanRows.length; offset += chunkSize) {
    const chunk = orphanRows.slice(offset, offset + chunkSize)
    const orphanResults: ChunkedResultRow[] = chunk.map((row) => {
      const key = fieldsA.map((f) => row.data[f] ?? "").join("|")
      return {
        keyValue: key,
        sourceARowIndex: row.index,
        sourceBRowIndex: null,
        status: "missing_b" as const,
        fields: []
      }
    })

    summary.totalRows += orphanResults.length
    summary.missingB += orphanResults.length

    await onChunkComplete({
      chunkIndex,
      results: orphanResults,
      processedRows: orphanResults.length,
      totalProcessedSoFar: totalProcessed + orphanResults.length
    })

    chunkIndex++
  }

  summary.chunksProcessed = chunkIndex
  summary.processingTimeMs = elapsed()
  summary.unexplained = summary.breaks - summary.explained

  onProgress?.({
    phase: "complete",
    processed: summary.totalRows,
    total: summary.totalRows,
    elapsedMs: elapsed()
  })

  return summary
}

// ---------------------------------------------------------------------------
// Determine optimal chunk size based on file characteristics
// ---------------------------------------------------------------------------

export function recommendChunkSize(
  totalRows: number,
  columnCount: number
): number {
  const envChunkSize = process.env.RECON_CHUNK_SIZE
    ? parseInt(process.env.RECON_CHUNK_SIZE, 10)
    : null

  if (envChunkSize && envChunkSize > 0) return envChunkSize

  // Heuristic: aim for ~2-4 MB per chunk of DB write data
  // Rough estimate: each cell ≈ 20 bytes, each row ≈ columnCount * 20 bytes
  const bytesPerRow = columnCount * 20
  const targetChunkBytes = 3 * 1024 * 1024 // 3 MB
  const calculated = Math.floor(targetChunkBytes / bytesPerRow)

  // Clamp to sensible range
  return Math.max(500, Math.min(calculated, 10_000))
}
