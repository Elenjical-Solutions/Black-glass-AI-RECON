"use server"

import { db } from "@/db/db"
import {
  reconciliationResultsTable,
  resultFieldDetailsTable,
  explanationKeysTable
} from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import {
  ReconciliationResult
} from "@/db/schema/results-schema"
import { ResultFieldDetail } from "@/db/schema/result-field-details-schema"
import { ExplanationKey } from "@/db/schema/explanation-keys-schema"
import { eq, and, inArray, like, sql, count } from "drizzle-orm"

export async function getResultsAction(
  runId: string,
  filters?: {
    status?: string
    explanationKeyId?: string
    search?: string
  },
  page: number = 1,
  pageSize: number = 50
): Promise<
  ActionState<{
    results: (ReconciliationResult & { explanationKey?: ExplanationKey | null })[]
    total: number
  }>
> {
  try {
    const conditions = [eq(reconciliationResultsTable.runId, runId)]

    if (filters?.status) {
      conditions.push(eq(reconciliationResultsTable.status, filters.status))
    }

    if (filters?.explanationKeyId) {
      if (filters.explanationKeyId === "__unassigned") {
        conditions.push(
          sql`${reconciliationResultsTable.explanationKeyId} IS NULL`
        )
      } else {
        conditions.push(
          eq(
            reconciliationResultsTable.explanationKeyId,
            filters.explanationKeyId
          )
        )
      }
    }

    if (filters?.search) {
      conditions.push(
        like(reconciliationResultsTable.rowKeyValue, `%${filters.search}%`)
      )
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(reconciliationResultsTable)
      .where(whereClause)

    // Get paginated results with left join on explanation keys
    const offset = (page - 1) * pageSize

    const rows = await db
      .select({
        result: reconciliationResultsTable,
        explanationKey: explanationKeysTable
      })
      .from(reconciliationResultsTable)
      .leftJoin(
        explanationKeysTable,
        eq(
          reconciliationResultsTable.explanationKeyId,
          explanationKeysTable.id
        )
      )
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)

    const results = rows.map(row => ({
      ...row.result,
      explanationKey: row.explanationKey
    }))

    return {
      status: "success",
      data: { results, total }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getResultDetailsAction(
  resultId: string
): Promise<
  ActionState<{
    result: ReconciliationResult
    fieldDetails: ResultFieldDetail[]
  }>
> {
  try {
    const [result] = await db
      .select()
      .from(reconciliationResultsTable)
      .where(eq(reconciliationResultsTable.id, resultId))

    if (!result) {
      return { status: "error", message: "Result not found" }
    }

    const fieldDetails = await db
      .select()
      .from(resultFieldDetailsTable)
      .where(eq(resultFieldDetailsTable.resultId, resultId))

    return {
      status: "success",
      data: { result, fieldDetails }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function assignExplanationKeyAction(
  resultId: string,
  explanationKeyId: string | null
): Promise<ActionState<void>> {
  try {
    await db
      .update(reconciliationResultsTable)
      .set({ explanationKeyId })
      .where(eq(reconciliationResultsTable.id, resultId))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function bulkAssignExplanationKeyAction(
  resultIds: string[],
  explanationKeyId: string
): Promise<ActionState<void>> {
  try {
    if (resultIds.length === 0) {
      return { status: "success", data: undefined }
    }

    await db
      .update(reconciliationResultsTable)
      .set({ explanationKeyId })
      .where(inArray(reconciliationResultsTable.id, resultIds))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
