"use server"

import { db } from "@/db/db"
import { regressionCyclesTable } from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { RegressionCycle } from "@/db/schema/cycles-schema"
import { eq } from "drizzle-orm"

export async function createCycleAction(
  projectId: string,
  name: string
): Promise<ActionState<RegressionCycle>> {
  try {
    const [cycle] = await db
      .insert(regressionCyclesTable)
      .values({ projectId, name })
      .returning()

    return { status: "success", data: cycle }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getCyclesForProjectAction(
  projectId: string
): Promise<ActionState<RegressionCycle[]>> {
  try {
    const cycles = await db
      .select()
      .from(regressionCyclesTable)
      .where(eq(regressionCyclesTable.projectId, projectId))

    return { status: "success", data: cycles }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getCycleByIdAction(
  cycleId: string
): Promise<ActionState<RegressionCycle>> {
  try {
    const [cycle] = await db
      .select()
      .from(regressionCyclesTable)
      .where(eq(regressionCyclesTable.id, cycleId))

    if (!cycle) {
      return { status: "error", message: "Cycle not found" }
    }

    return { status: "success", data: cycle }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function updateCycleStatusAction(
  cycleId: string,
  status: string
): Promise<ActionState<RegressionCycle>> {
  try {
    const updateData: Record<string, any> = { status }

    if (status === "running") {
      updateData.startedAt = new Date()
    } else if (status === "completed") {
      updateData.completedAt = new Date()
    }

    const [cycle] = await db
      .update(regressionCyclesTable)
      .set(updateData)
      .where(eq(regressionCyclesTable.id, cycleId))
      .returning()

    if (!cycle) {
      return { status: "error", message: "Cycle not found" }
    }

    return { status: "success", data: cycle }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function deleteCycleAction(
  cycleId: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(regressionCyclesTable)
      .where(eq(regressionCyclesTable.id, cycleId))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
