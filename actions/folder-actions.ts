"use server"

import { db } from "@/db/db"
import {
  uploadedFilesTable,
  reconciliationDefinitionsTable,
  fieldMappingsTable
} from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { UploadedFile } from "@/db/schema/uploaded-files-schema"
import { ReconciliationDefinition } from "@/db/schema/definitions-schema"
import {
  scanFolder,
  matchFolderFiles,
  readFileContent,
  FolderScanResult,
  FolderMatchResult,
  ScannedFile
} from "@/lib/recon/folder-scanner"
import { parseFile, detectFormat } from "@/lib/recon/parsers"
import { suggestFieldMappings } from "@/lib/ai/field-mapping-suggest"

const DEMO_USER_ID = "demo-user"

// ---------------------------------------------------------------------------
// Scan a folder
// ---------------------------------------------------------------------------

export interface ScanFolderResponse {
  folderPath: string
  files: Array<{
    filename: string
    fullPath: string
    relativePath: string
    extension: string
    size: number
    modifiedAt: string
  }>
  totalFiles: number
  supportedFiles: number
}

export async function scanFolderAction(
  folderPath: string,
  recursive: boolean = true
): Promise<ActionState<ScanFolderResponse>> {
  try {
    const result = scanFolder(folderPath, recursive)
    return {
      status: "success",
      data: {
        folderPath: result.folderPath,
        files: result.files.map((f) => ({
          ...f,
          modifiedAt: f.modifiedAt.toISOString()
        })),
        totalFiles: result.totalFiles,
        supportedFiles: result.supportedFiles
      }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// Match files between two folders
// ---------------------------------------------------------------------------

export interface MatchFoldersResponse {
  matched: Array<{
    fileA: { filename: string; fullPath: string; size: number; extension: string }
    fileB: { filename: string; fullPath: string; size: number; extension: string }
    matchedBy: string
    confidence: number
  }>
  unmatchedA: Array<{ filename: string; fullPath: string; size: number }>
  unmatchedB: Array<{ filename: string; fullPath: string; size: number }>
}

export async function matchFoldersAction(
  folderPathA: string,
  folderPathB: string,
  recursive: boolean = true
): Promise<ActionState<MatchFoldersResponse>> {
  try {
    const scanA = scanFolder(folderPathA, recursive)
    const scanB = scanFolder(folderPathB, recursive)
    const result = matchFolderFiles(scanA, scanB)

    return {
      status: "success",
      data: {
        matched: result.matched.map((m) => ({
          fileA: {
            filename: m.fileA.filename,
            fullPath: m.fileA.fullPath,
            size: m.fileA.size,
            extension: m.fileA.extension
          },
          fileB: {
            filename: m.fileB.filename,
            fullPath: m.fileB.fullPath,
            size: m.fileB.size,
            extension: m.fileB.extension
          },
          matchedBy: m.matchedBy,
          confidence: m.confidence
        })),
        unmatchedA: result.unmatchedA.map((f) => ({
          filename: f.filename,
          fullPath: f.fullPath,
          size: f.size
        })),
        unmatchedB: result.unmatchedB.map((f) => ({
          filename: f.filename,
          fullPath: f.fullPath,
          size: f.size
        }))
      }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// Import matched folder files into a project + auto-create definitions
// ---------------------------------------------------------------------------

export interface ImportFoldersResponse {
  importedFiles: number
  createdDefinitions: number
  definitions: Array<{
    id: string
    name: string
    fileAName: string
    fileBName: string
  }>
  aiMappingsApplied: number
}

export async function importFromFoldersAction(
  projectId: string,
  folderPathA: string,
  folderPathB: string,
  options: {
    recursive?: boolean
    autoCreateDefinitions?: boolean
    autoAiFieldMapping?: boolean
    selectedPairs?: Array<{ fileAPath: string; fileBPath: string }>
  } = {}
): Promise<ActionState<ImportFoldersResponse>> {
  try {
    const {
      recursive = true,
      autoCreateDefinitions = true,
      autoAiFieldMapping = false,
      selectedPairs
    } = options

    // Scan and match
    const scanA = scanFolder(folderPathA, recursive)
    const scanB = scanFolder(folderPathB, recursive)
    const matchResult = matchFolderFiles(scanA, scanB)

    // Determine which pairs to import
    let pairs = matchResult.matched
    if (selectedPairs && selectedPairs.length > 0) {
      const selectedSet = new Set(
        selectedPairs.map((p) => `${p.fileAPath}|${p.fileBPath}`)
      )
      pairs = pairs.filter(
        (p) => selectedSet.has(`${p.fileA.fullPath}|${p.fileB.fullPath}`)
      )
    }

    let importedFiles = 0
    let createdDefinitions = 0
    let aiMappingsApplied = 0
    const definitions: Array<{
      id: string
      name: string
      fileAName: string
      fileBName: string
    }> = []

    for (const pair of pairs) {
      // Read file contents from disk
      const contentA = readFileContent(pair.fileA.fullPath)
      const contentB = readFileContent(pair.fileB.fullPath)

      const formatA = detectFormat(pair.fileA.filename, contentA)
      const formatB = detectFormat(pair.fileB.filename, contentB)

      const parsedA = parseFile(contentA, formatA)
      const parsedB = parseFile(contentB, formatB)

      // Upload File A
      const [uploadedA] = await db
        .insert(uploadedFilesTable)
        .values({
          projectId,
          uploaderId: DEMO_USER_ID,
          filename: pair.fileA.filename,
          mimeType: formatA === "csv" ? "text/csv" : "application/xml",
          size: pair.fileA.size,
          fileRole: "source_a",
          fileContent: contentA,
          parsedHeaders: parsedA.headers,
          rowCount: parsedA.totalRows
        })
        .returning()

      // Upload File B
      const [uploadedB] = await db
        .insert(uploadedFilesTable)
        .values({
          projectId,
          uploaderId: DEMO_USER_ID,
          filename: pair.fileB.filename,
          mimeType: formatB === "csv" ? "text/csv" : "application/xml",
          size: pair.fileB.size,
          fileRole: "source_b",
          fileContent: contentB,
          parsedHeaders: parsedB.headers,
          rowCount: parsedB.totalRows
        })
        .returning()

      importedFiles += 2

      // Auto-create reconciliation definition
      if (autoCreateDefinitions) {
        const defName = deriveDefinitionName(
          pair.fileA.filename,
          pair.fileB.filename
        )

        const [definition] = await db
          .insert(reconciliationDefinitionsTable)
          .values({
            projectId,
            name: defName,
            description: `Auto-created from folder scan.\nSource A: ${pair.fileA.relativePath}\nSource B: ${pair.fileB.relativePath}\nMatch: ${pair.matchedBy} (${Math.round(pair.confidence * 100)}% confidence)`,
            sourceAFileId: uploadedA.id,
            sourceBFileId: uploadedB.id,
            keyFields: []
          })
          .returning()

        createdDefinitions++
        definitions.push({
          id: definition.id,
          name: defName,
          fileAName: pair.fileA.filename,
          fileBName: pair.fileB.filename
        })

        // Auto AI field mapping
        if (autoAiFieldMapping && parsedA.headers.length > 0 && parsedB.headers.length > 0) {
          try {
            const sampleA = parsedA.rows.slice(0, 3).map((r) => r.data)
            const sampleB = parsedB.rows.slice(0, 3).map((r) => r.data)

            const suggestions = await suggestFieldMappings(
              parsedA.headers,
              parsedB.headers,
              sampleA,
              sampleB
            )

            if (suggestions.length > 0) {
              const mappingValues = suggestions.map((s, idx) => ({
                definitionId: definition.id,
                fieldNameA: s.fieldA,
                fieldNameB: s.fieldB,
                matcherType: s.matcherType,
                tolerance: s.suggestedTolerance?.toString() ?? null,
                toleranceType: s.suggestedTolerance ? "absolute" : null,
                isKey: idx === 0, // First suggested mapping as key by default
                sortOrder: idx
              }))

              await db.insert(fieldMappingsTable).values(mappingValues as any[])
              aiMappingsApplied++
            }
          } catch {
            // AI mapping is best-effort — don't fail the import
          }
        }
      }
    }

    return {
      status: "success",
      data: {
        importedFiles,
        createdDefinitions,
        definitions,
        aiMappingsApplied
      }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable definition name from two filenames.
 * E.g., "old_pnl_report.csv" + "new_pnl_report.csv" → "PnL Report"
 */
function deriveDefinitionName(filenameA: string, filenameB: string): string {
  const stemA = filenameA
    .replace(/\.[^.]+$/, "")
    .replace(/^(old|new|before|after|v1|v2|source|target|current|previous)[_-]/i, "")
    .replace(/[_-](old|new|before|after|v1|v2|source|target|current|previous)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()

  const stemB = filenameB
    .replace(/\.[^.]+$/, "")
    .replace(/^(old|new|before|after|v1|v2|source|target|current|previous)[_-]/i, "")
    .replace(/[_-](old|new|before|after|v1|v2|source|target|current|previous)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()

  // If stems are the same, use it as the definition name
  if (stemA.toLowerCase() === stemB.toLowerCase()) {
    return titleCase(stemA)
  }

  // Otherwise combine them
  return `${titleCase(stemA)} vs ${titleCase(stemB)}`
}

function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}
