import * as fs from "fs"
import * as path from "path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannedFile {
  filename: string
  fullPath: string
  relativePath: string
  extension: string
  size: number
  modifiedAt: Date
}

export interface FolderScanResult {
  folderPath: string
  files: ScannedFile[]
  totalFiles: number
  supportedFiles: number
}

export interface FileMatchPair {
  fileA: ScannedFile
  fileB: ScannedFile
  matchedBy: "exact_name" | "stem_match" | "pattern" | "ai_suggested"
  confidence: number
}

export interface FolderMatchResult {
  matched: FileMatchPair[]
  unmatchedA: ScannedFile[]
  unmatchedB: ScannedFile[]
}

// ---------------------------------------------------------------------------
// Supported extensions
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([".csv", ".xml", ".tsv", ".txt"])

// ---------------------------------------------------------------------------
// Folder scanning
// ---------------------------------------------------------------------------

/**
 * Recursively scan a folder for reconciliation-eligible files.
 */
export function scanFolder(
  folderPath: string,
  recursive: boolean = true
): FolderScanResult {
  const resolvedPath = path.resolve(folderPath)

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Folder does not exist: ${resolvedPath}`)
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`)
  }

  const files: ScannedFile[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory() && recursive) {
        // Skip hidden directories
        if (!entry.name.startsWith(".")) {
          walk(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        const stats = fs.statSync(fullPath)
        files.push({
          filename: entry.name,
          fullPath,
          relativePath: path.relative(resolvedPath, fullPath),
          extension: ext,
          size: stats.size,
          modifiedAt: stats.mtime
        })
      }
    }
  }

  walk(resolvedPath)

  const supportedFiles = files.filter((f) =>
    SUPPORTED_EXTENSIONS.has(f.extension)
  )

  return {
    folderPath: resolvedPath,
    files: supportedFiles,
    totalFiles: files.length,
    supportedFiles: supportedFiles.length
  }
}

// ---------------------------------------------------------------------------
// File matching between two folders
// ---------------------------------------------------------------------------

/**
 * Match files between folder A and folder B using multiple strategies:
 *
 * 1. **Exact name match** — same filename in both folders
 * 2. **Stem match** — same filename stem after removing common prefixes/suffixes
 *    like "old_", "new_", "_v1", "_v2", "_before", "_after"
 * 3. **Relative path match** — same relative path within the folder tree
 */
export function matchFolderFiles(
  folderA: FolderScanResult,
  folderB: FolderScanResult
): FolderMatchResult {
  const matched: FileMatchPair[] = []
  const usedA = new Set<string>()
  const usedB = new Set<string>()

  const filesA = folderA.files
  const filesB = folderB.files

  // Strategy 1: Exact filename match
  const nameMapB = new Map<string, ScannedFile>()
  for (const f of filesB) {
    nameMapB.set(f.filename.toLowerCase(), f)
  }
  for (const fA of filesA) {
    const fB = nameMapB.get(fA.filename.toLowerCase())
    if (fB && !usedA.has(fA.fullPath) && !usedB.has(fB.fullPath)) {
      matched.push({
        fileA: fA,
        fileB: fB,
        matchedBy: "exact_name",
        confidence: 1.0
      })
      usedA.add(fA.fullPath)
      usedB.add(fB.fullPath)
    }
  }

  // Strategy 2: Relative path match (for recursive folder scans)
  const relPathMapB = new Map<string, ScannedFile>()
  for (const f of filesB) {
    relPathMapB.set(f.relativePath.toLowerCase(), f)
  }
  for (const fA of filesA) {
    if (usedA.has(fA.fullPath)) continue
    const fB = relPathMapB.get(fA.relativePath.toLowerCase())
    if (fB && !usedB.has(fB.fullPath)) {
      matched.push({
        fileA: fA,
        fileB: fB,
        matchedBy: "exact_name",
        confidence: 0.95
      })
      usedA.add(fA.fullPath)
      usedB.add(fB.fullPath)
    }
  }

  // Strategy 3: Stem matching (strip common old/new prefixes and suffixes)
  const STRIP_PATTERNS = [
    /^(old|new|before|after|v1|v2|source|target|current|previous)[_-]/i,
    /[_-](old|new|before|after|v1|v2|source|target|current|previous)$/i,
    /^(prod|uat|staging|dev)[_-]/i,
    /[_-](prod|uat|staging|dev)$/i
  ]

  function getStem(filename: string): string {
    let stem = path.basename(filename, path.extname(filename)).toLowerCase()
    for (const pattern of STRIP_PATTERNS) {
      stem = stem.replace(pattern, "")
    }
    // Also strip trailing/leading underscores/dashes
    return stem.replace(/^[_-]+|[_-]+$/g, "")
  }

  const stemMapB = new Map<string, ScannedFile[]>()
  for (const f of filesB) {
    if (usedB.has(f.fullPath)) continue
    const stem = getStem(f.filename)
    if (!stemMapB.has(stem)) stemMapB.set(stem, [])
    stemMapB.get(stem)!.push(f)
  }

  for (const fA of filesA) {
    if (usedA.has(fA.fullPath)) continue
    const stem = getStem(fA.filename)
    const candidates = stemMapB.get(stem)
    if (candidates && candidates.length > 0) {
      // Pick the first unused candidate with the same extension
      const sameExt = candidates.find(
        (c) => c.extension === fA.extension && !usedB.has(c.fullPath)
      )
      const fB = sameExt || candidates.find((c) => !usedB.has(c.fullPath))
      if (fB) {
        matched.push({
          fileA: fA,
          fileB: fB,
          matchedBy: "stem_match",
          confidence: sameExt ? 0.85 : 0.7
        })
        usedA.add(fA.fullPath)
        usedB.add(fB.fullPath)
      }
    }
  }

  const unmatchedA = filesA.filter((f) => !usedA.has(f.fullPath))
  const unmatchedB = filesB.filter((f) => !usedB.has(f.fullPath))

  // Sort matched by confidence descending
  matched.sort((a, b) => b.confidence - a.confidence)

  return { matched, unmatchedA, unmatchedB }
}

// ---------------------------------------------------------------------------
// Read file content from disk
// ---------------------------------------------------------------------------

export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8")
}

export function getFileStats(filePath: string): {
  size: number
  modifiedAt: Date
} {
  const stats = fs.statSync(filePath)
  return { size: stats.size, modifiedAt: stats.mtime }
}
