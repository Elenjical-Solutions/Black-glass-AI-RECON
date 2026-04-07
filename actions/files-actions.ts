"use server"

import { db } from "@/db/db"
import { uploadedFilesTable } from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { UploadedFile } from "@/db/schema/uploaded-files-schema"
import { eq } from "drizzle-orm"
import { parseFile, detectFormat } from "@/lib/recon/parsers"
import { getAuthUserId } from "@/lib/auth"

export async function uploadFileAction(
  formData: FormData
): Promise<ActionState<UploadedFile>> {
  try {
    const userId = await getAuthUserId()
    const file = formData.get("file") as File | null
    const projectId = formData.get("projectId") as string | null
    const fileRole = (formData.get("fileRole") as string) || "source_a"

    if (!file) {
      return { status: "error", message: "No file provided" }
    }

    if (!projectId) {
      return { status: "error", message: "No projectId provided" }
    }

    const content = await file.text()
    const format = detectFormat(file.name, content)
    const parsed = parseFile(content, format)

    const [uploadedFile] = await db
      .insert(uploadedFilesTable)
      .values({
        projectId,
        uploaderId: userId,
        filename: file.name,
        mimeType: file.type || "text/csv",
        size: file.size,
        fileRole,
        fileContent: content,
        parsedHeaders: parsed.headers,
        rowCount: parsed.totalRows
      })
      .returning()

    return { status: "success", data: uploadedFile }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

/**
 * List files for a project WITHOUT loading fileContent (the massive CSV/XML body).
 * fileContent is only loaded when explicitly needed (preview, reconciliation run).
 */
export async function getFilesForProjectAction(
  projectId: string
): Promise<ActionState<Omit<UploadedFile, "fileContent">[]>> {
  try {
    const files = await db
      .select({
        id: uploadedFilesTable.id,
        projectId: uploadedFilesTable.projectId,
        uploaderId: uploadedFilesTable.uploaderId,
        filename: uploadedFilesTable.filename,
        mimeType: uploadedFilesTable.mimeType,
        size: uploadedFilesTable.size,
        fileRole: uploadedFilesTable.fileRole,
        parsedHeaders: uploadedFilesTable.parsedHeaders,
        rowCount: uploadedFilesTable.rowCount,
        createdAt: uploadedFilesTable.createdAt,
        updatedAt: uploadedFilesTable.updatedAt,
      })
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.projectId, projectId))

    return { status: "success", data: files as any }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getFilePreviewAction(
  fileId: string,
  limit: number = 10
): Promise<
  ActionState<{ headers: string[]; rows: Record<string, string>[] }>
> {
  try {
    const [file] = await db
      .select({
        filename: uploadedFilesTable.filename,
        fileContent: uploadedFilesTable.fileContent,
      })
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.id, fileId))

    if (!file) {
      return { status: "error", message: "File not found" }
    }

    if (!file.fileContent) {
      return { status: "error", message: "File content not available" }
    }

    const format = detectFormat(file.filename, file.fileContent)
    const parsed = parseFile(file.fileContent, format)

    const rows = parsed.rows.slice(0, limit).map(row => row.data)

    return {
      status: "success",
      data: { headers: parsed.headers, rows }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function deleteFileAction(
  fileId: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(uploadedFilesTable)
      .where(eq(uploadedFilesTable.id, fileId))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
