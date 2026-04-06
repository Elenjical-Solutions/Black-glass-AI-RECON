"use server"

import { db } from "@/db/db"
import { screenshotsTable } from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { Screenshot } from "@/db/schema/screenshots-schema"
import { eq } from "drizzle-orm"

export async function uploadScreenshotAction(
  formData: FormData
): Promise<ActionState<Screenshot>> {
  try {
    const file = formData.get("file") as File | null
    const projectId = formData.get("projectId") as string | null
    const label = (formData.get("label") as string) || "Untitled"
    const systemSide = (formData.get("systemSide") as string) || "source_a"

    if (!file) {
      return { status: "error", message: "No file provided" }
    }

    if (!projectId) {
      return { status: "error", message: "No projectId provided" }
    }

    // Read image as base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const imageData = `data:${file.type};base64,${base64}`

    const [screenshot] = await db
      .insert(screenshotsTable)
      .values({
        projectId,
        imageData,
        label,
        systemSide
      })
      .returning()

    return { status: "success", data: screenshot }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getScreenshotsForProjectAction(
  projectId: string
): Promise<ActionState<Screenshot[]>> {
  try {
    const screenshots = await db
      .select()
      .from(screenshotsTable)
      .where(eq(screenshotsTable.projectId, projectId))

    return { status: "success", data: screenshots }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function deleteScreenshotAction(
  id: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(screenshotsTable)
      .where(eq(screenshotsTable.id, id))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
