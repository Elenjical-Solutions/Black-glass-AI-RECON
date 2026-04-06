"use server"

import { db } from "@/db/db"
import { reconciliationProjectsTable } from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { ReconciliationProject } from "@/db/schema/projects-schema"
import { eq } from "drizzle-orm"

const DEMO_USER_ID = "demo-user"

export async function createProjectAction(
  name: string,
  description?: string
): Promise<ActionState<ReconciliationProject>> {
  try {
    const [project] = await db
      .insert(reconciliationProjectsTable)
      .values({
        userId: DEMO_USER_ID,
        name,
        description: description ?? null
      })
      .returning()

    return { status: "success", data: project }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getProjectsAction(): Promise<
  ActionState<ReconciliationProject[]>
> {
  try {
    const projects = await db
      .select()
      .from(reconciliationProjectsTable)
      .where(eq(reconciliationProjectsTable.userId, DEMO_USER_ID))

    return { status: "success", data: projects }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getProjectByIdAction(
  projectId: string
): Promise<ActionState<ReconciliationProject>> {
  try {
    const [project] = await db
      .select()
      .from(reconciliationProjectsTable)
      .where(eq(reconciliationProjectsTable.id, projectId))

    if (!project) {
      return { status: "error", message: "Project not found" }
    }

    return { status: "success", data: project }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function updateProjectAction(
  projectId: string,
  data: { name?: string; description?: string }
): Promise<ActionState<ReconciliationProject>> {
  try {
    const [project] = await db
      .update(reconciliationProjectsTable)
      .set(data)
      .where(eq(reconciliationProjectsTable.id, projectId))
      .returning()

    if (!project) {
      return { status: "error", message: "Project not found" }
    }

    return { status: "success", data: project }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function deleteProjectAction(
  projectId: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(reconciliationProjectsTable)
      .where(eq(reconciliationProjectsTable.id, projectId))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
