"use server"

import { db } from "@/db/db"
import { fieldMappingsTable } from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { FieldMapping } from "@/db/schema/field-mappings-schema"
import { eq } from "drizzle-orm"

export async function saveFieldMappingsAction(
  definitionId: string,
  mappings: Array<{
    fieldNameA: string
    fieldNameB: string
    matcherType: string
    tolerance?: string
    toleranceType?: string
    isKey?: boolean
    sortOrder?: number
  }>
): Promise<ActionState<FieldMapping[]>> {
  try {
    // Delete existing mappings for this definition
    await db
      .delete(fieldMappingsTable)
      .where(eq(fieldMappingsTable.definitionId, definitionId))

    if (mappings.length === 0) {
      return { status: "success", data: [] }
    }

    // Insert new mappings
    const inserted = await db
      .insert(fieldMappingsTable)
      .values(
        mappings.map((m, index) => ({
          definitionId,
          fieldNameA: m.fieldNameA,
          fieldNameB: m.fieldNameB,
          matcherType: m.matcherType,
          tolerance: m.tolerance ?? null,
          toleranceType: m.toleranceType ?? null,
          isKey: m.isKey ?? false,
          sortOrder: m.sortOrder ?? index
        }))
      )
      .returning()

    return { status: "success", data: inserted }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getFieldMappingsAction(
  definitionId: string
): Promise<ActionState<FieldMapping[]>> {
  try {
    const mappings = await db
      .select()
      .from(fieldMappingsTable)
      .where(eq(fieldMappingsTable.definitionId, definitionId))

    return { status: "success", data: mappings }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
