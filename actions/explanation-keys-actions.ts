"use server"

import { db } from "@/db/db"
import { explanationKeysTable } from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { ExplanationKey } from "@/db/schema/explanation-keys-schema"
import { eq } from "drizzle-orm"

export async function createExplanationKeyAction(data: {
  projectId: string
  code: string
  label: string
  description?: string
  autoMatchPattern?: any
  color?: string
}): Promise<ActionState<ExplanationKey>> {
  try {
    const [key] = await db
      .insert(explanationKeysTable)
      .values({
        projectId: data.projectId,
        code: data.code,
        label: data.label,
        description: data.description ?? null,
        autoMatchPattern: data.autoMatchPattern ?? null,
        color: data.color ?? null
      })
      .returning()

    return { status: "success", data: key }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getExplanationKeysAction(
  projectId: string
): Promise<ActionState<ExplanationKey[]>> {
  try {
    const keys = await db
      .select()
      .from(explanationKeysTable)
      .where(eq(explanationKeysTable.projectId, projectId))

    return { status: "success", data: keys }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function updateExplanationKeyAction(
  id: string,
  data: Partial<{
    code: string
    label: string
    description: string
    autoMatchPattern: any
    color: string
  }>
): Promise<ActionState<ExplanationKey>> {
  try {
    const [key] = await db
      .update(explanationKeysTable)
      .set(data)
      .where(eq(explanationKeysTable.id, id))
      .returning()

    if (!key) {
      return { status: "error", message: "Explanation key not found" }
    }

    return { status: "success", data: key }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function deleteExplanationKeyAction(
  id: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(explanationKeysTable)
      .where(eq(explanationKeysTable.id, id))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
