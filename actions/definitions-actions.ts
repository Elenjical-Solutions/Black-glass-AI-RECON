"use server"

import { db } from "@/db/db"
import {
  reconciliationDefinitionsTable,
  fieldMappingsTable
} from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import {
  ReconciliationDefinition,
  InsertReconciliationDefinition
} from "@/db/schema/definitions-schema"
import { FieldMapping } from "@/db/schema/field-mappings-schema"
import { eq } from "drizzle-orm"

export async function createDefinitionAction(data: {
  projectId: string
  name: string
  description?: string
  sourceAFileId?: string
  sourceBFileId?: string
  keyFields?: any
  category?: string
  department?: string
}): Promise<ActionState<ReconciliationDefinition>> {
  try {
    const [definition] = await db
      .insert(reconciliationDefinitionsTable)
      .values({
        projectId: data.projectId,
        name: data.name,
        description: data.description ?? null,
        sourceAFileId: data.sourceAFileId ?? null,
        sourceBFileId: data.sourceBFileId ?? null,
        category: data.category ?? null,
        department: data.department ?? null,
        keyFields: data.keyFields ?? []
      })
      .returning()

    return { status: "success", data: definition }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getDefinitionsForProjectAction(
  projectId: string
): Promise<ActionState<ReconciliationDefinition[]>> {
  try {
    const definitions = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.projectId, projectId))

    return { status: "success", data: definitions }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getDefinitionByIdAction(
  definitionId: string
): Promise<
  ActionState<ReconciliationDefinition & { fieldMappings: FieldMapping[] }>
> {
  try {
    const [definition] = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, definitionId))

    if (!definition) {
      return { status: "error", message: "Definition not found" }
    }

    const fieldMappings = await db
      .select()
      .from(fieldMappingsTable)
      .where(eq(fieldMappingsTable.definitionId, definitionId))

    return {
      status: "success",
      data: { ...definition, fieldMappings }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function updateDefinitionAction(
  definitionId: string,
  data: Partial<{
    name: string
    description: string
    sourceAFileId: string
    sourceBFileId: string
    keyFields: any
  }>
): Promise<ActionState<ReconciliationDefinition>> {
  try {
    const [definition] = await db
      .update(reconciliationDefinitionsTable)
      .set(data)
      .where(eq(reconciliationDefinitionsTable.id, definitionId))
      .returning()

    if (!definition) {
      return { status: "error", message: "Definition not found" }
    }

    return { status: "success", data: definition }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function deleteDefinitionAction(
  definitionId: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, definitionId))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
