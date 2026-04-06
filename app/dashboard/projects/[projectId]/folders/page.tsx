"use client"

import { useState, use } from "react"
import {
  scanFolderAction,
  matchFoldersAction,
  importFromFoldersAction,
  ScanFolderResponse,
  MatchFoldersResponse,
  ImportFoldersResponse
} from "@/actions/folder-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  FolderOpen,
  FolderSearch,
  ArrowRight,
  Link2,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileSpreadsheet,
  Import,
  ArrowLeftRight
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FoldersPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)

  // Folder paths
  const [folderA, setFolderA] = useState("")
  const [folderB, setFolderB] = useState("")
  const [recursive, setRecursive] = useState(true)

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanResultA, setScanResultA] = useState<ScanFolderResponse | null>(null)
  const [scanResultB, setScanResultB] = useState<ScanFolderResponse | null>(null)

  // Match state
  const [matching, setMatching] = useState(false)
  const [matchResult, setMatchResult] = useState<MatchFoldersResponse | null>(null)
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set())

  // Import state
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportFoldersResponse | null>(null)
  const [autoAiMapping, setAutoAiMapping] = useState(true)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // ── Scan both folders ────────────────────────────────────────────────
  async function handleScan() {
    if (!folderA.trim() || !folderB.trim()) {
      toast.error("Please provide both folder paths")
      return
    }

    setScanning(true)
    setScanResultA(null)
    setScanResultB(null)
    setMatchResult(null)
    setImportResult(null)

    try {
      const [resA, resB] = await Promise.all([
        scanFolderAction(folderA.trim(), recursive),
        scanFolderAction(folderB.trim(), recursive)
      ])

      if (resA.status === "error") {
        toast.error(`Folder A: ${resA.message}`)
        setScanning(false)
        return
      }
      if (resB.status === "error") {
        toast.error(`Folder B: ${resB.message}`)
        setScanning(false)
        return
      }

      setScanResultA(resA.data)
      setScanResultB(resB.data)

      toast.success(
        `Found ${resA.data.supportedFiles} files in A, ${resB.data.supportedFiles} files in B`
      )
    } catch {
      toast.error("Failed to scan folders")
    } finally {
      setScanning(false)
    }
  }

  // ── Match files between folders ──────────────────────────────────────
  async function handleMatch() {
    setMatching(true)
    setMatchResult(null)

    try {
      const result = await matchFoldersAction(folderA.trim(), folderB.trim(), recursive)
      if (result.status === "error") {
        toast.error(result.message)
      } else {
        setMatchResult(result.data)
        // Select all matched pairs by default
        setSelectedPairs(new Set(result.data.matched.map((_, i) => i)))
        toast.success(
          `Matched ${result.data.matched.length} file pairs, ${result.data.unmatchedA.length} unmatched in A, ${result.data.unmatchedB.length} unmatched in B`
        )
      }
    } catch {
      toast.error("Failed to match folders")
    } finally {
      setMatching(false)
    }
  }

  // ── Import selected pairs ────────────────────────────────────────────
  async function handleImport() {
    if (!matchResult) return

    const pairs = matchResult.matched
      .filter((_, i) => selectedPairs.has(i))
      .map((m) => ({
        fileAPath: m.fileA.fullPath,
        fileBPath: m.fileB.fullPath
      }))

    if (pairs.length === 0) {
      toast.error("No file pairs selected")
      return
    }

    setImporting(true)

    try {
      const result = await importFromFoldersAction(projectId, folderA.trim(), folderB.trim(), {
        recursive,
        autoCreateDefinitions: true,
        autoAiFieldMapping: autoAiMapping,
        selectedPairs: pairs
      })

      if (result.status === "error") {
        toast.error(result.message)
      } else {
        setImportResult(result.data)
        setImportDialogOpen(true)
        toast.success(
          `Imported ${result.data.importedFiles} files, created ${result.data.createdDefinitions} definitions`
        )
      }
    } catch {
      toast.error("Failed to import files")
    } finally {
      setImporting(false)
    }
  }

  function togglePair(index: number) {
    const next = new Set(selectedPairs)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelectedPairs(next)
  }

  function toggleAllPairs() {
    if (!matchResult) return
    if (selectedPairs.size === matchResult.matched.length) {
      setSelectedPairs(new Set())
    } else {
      setSelectedPairs(new Set(matchResult.matched.map((_, i) => i)))
    }
  }

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 0.9)
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">High</Badge>
    if (confidence >= 0.7)
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Low</Badge>
  }

  const matchByBadge = (matchedBy: string) => {
    switch (matchedBy) {
      case "exact_name":
        return <Badge variant="outline" className="text-xs">Exact Name</Badge>
      case "stem_match":
        return <Badge variant="outline" className="text-xs">Stem Match</Badge>
      case "pattern":
        return <Badge variant="outline" className="text-xs">Pattern</Badge>
      case "ai_suggested":
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
            <Sparkles className="h-3 w-3 mr-1" />AI
          </Badge>
        )
      default:
        return <Badge variant="outline" className="text-xs">{matchedBy}</Badge>
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gradient">Folder Scanner</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Point to two folders and auto-discover, match, and import files for reconciliation
        </p>
      </div>

      {/* Folder input */}
      <Card className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Folder A */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-400" />
              Folder A (Source / Old System)
            </Label>
            <Input
              placeholder="/path/to/source/folder"
              value={folderA}
              onChange={(e) => setFolderA(e.target.value)}
              className="font-mono text-sm"
            />
            {scanResultA && (
              <p className="text-xs text-muted-foreground">
                {scanResultA.supportedFiles} supported files found
                ({scanResultA.totalFiles} total)
              </p>
            )}
          </div>

          {/* Folder B */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-cyan-400" />
              Folder B (Target / New System)
            </Label>
            <Input
              placeholder="/path/to/target/folder"
              value={folderB}
              onChange={(e) => setFolderB(e.target.value)}
              className="font-mono text-sm"
            />
            {scanResultB && (
              <p className="text-xs text-muted-foreground">
                {scanResultB.supportedFiles} supported files found
                ({scanResultB.totalFiles} total)
              </p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-6 mt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={recursive}
              onCheckedChange={(checked) => setRecursive(!!checked)}
            />
            Scan subdirectories recursively
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={autoAiMapping}
              onCheckedChange={(checked) => setAutoAiMapping(!!checked)}
            />
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            Auto AI field mapping
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          <Button onClick={handleScan} disabled={scanning || !folderA || !folderB}>
            {scanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FolderSearch className="h-4 w-4 mr-2" />
            )}
            Scan Folders
          </Button>

          {scanResultA && scanResultB && (
            <Button
              onClick={handleMatch}
              disabled={matching}
              variant="secondary"
            >
              {matching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Match Files
            </Button>
          )}
        </div>
      </Card>

      {/* Scan results - side by side file lists */}
      {scanResultA && scanResultB && !matchResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card overflow-hidden">
            <div className="p-3 border-b border-border/50 flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                Folder A
              </Badge>
              <span className="text-sm text-muted-foreground truncate">
                {scanResultA.folderPath}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableBody>
                  {scanResultA.files.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{f.relativePath}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                        {formatSize(f.size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="glass-card overflow-hidden">
            <div className="p-3 border-b border-border/50 flex items-center gap-2">
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                Folder B
              </Badge>
              <span className="text-sm text-muted-foreground truncate">
                {scanResultB.folderPath}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableBody>
                  {scanResultB.files.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{f.relativePath}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                        {formatSize(f.size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* Match results */}
      {matchResult && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass-card p-4 glow-green">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold">{matchResult.matched.length}</p>
                  <p className="text-xs text-muted-foreground">Matched Pairs</p>
                </div>
              </div>
            </Card>
            <Card className="glass-card p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold">{matchResult.unmatchedA.length}</p>
                  <p className="text-xs text-muted-foreground">Unmatched in A</p>
                </div>
              </div>
            </Card>
            <Card className="glass-card p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold">{matchResult.unmatchedB.length}</p>
                  <p className="text-xs text-muted-foreground">Unmatched in B</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Matched pairs table */}
          {matchResult.matched.length > 0 && (
            <Card className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Matched File Pairs</h3>
                  <Badge variant="outline">{selectedPairs.size} selected</Badge>
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importing || selectedPairs.size === 0}
                  size="sm"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4 mr-2" />
                  )}
                  Import Selected ({selectedPairs.size})
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selectedPairs.size === matchResult.matched.length
                        }
                        onCheckedChange={toggleAllPairs}
                      />
                    </TableHead>
                    <TableHead>File A (Source)</TableHead>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>File B (Target)</TableHead>
                    <TableHead>Match Method</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Sizes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchResult.matched.map((pair, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        "cursor-pointer",
                        selectedPairs.has(i) && "bg-accent/30"
                      )}
                      onClick={() => togglePair(i)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedPairs.has(i)}
                          onCheckedChange={() => togglePair(i)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-blue-400 shrink-0" />
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {pair.fileA.filename}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {pair.fileB.filename}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{matchByBadge(pair.matchedBy)}</TableCell>
                      <TableCell>{confidenceBadge(pair.confidence)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatSize(pair.fileA.size)} / {formatSize(pair.fileB.size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Unmatched files */}
          {(matchResult.unmatchedA.length > 0 || matchResult.unmatchedB.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchResult.unmatchedA.length > 0 && (
                <Card className="glass-card overflow-hidden">
                  <div className="p-3 border-b border-border/50 flex items-center gap-2">
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      Unmatched A
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Only in source folder
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableBody>
                        {matchResult.unmatchedA.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-1.5 text-sm">
                              {f.filename}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                              {formatSize(f.size)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
              {matchResult.unmatchedB.length > 0 && (
                <Card className="glass-card overflow-hidden">
                  <div className="p-3 border-b border-border/50 flex items-center gap-2">
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      Unmatched B
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Only in target folder
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableBody>
                        {matchResult.unmatchedB.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-1.5 text-sm">
                              {f.filename}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                              {formatSize(f.size)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Import success dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Import Complete
            </DialogTitle>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-accent/30">
                  <p className="text-2xl font-bold">{importResult.importedFiles}</p>
                  <p className="text-xs text-muted-foreground">Files Imported</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-accent/30">
                  <p className="text-2xl font-bold">{importResult.createdDefinitions}</p>
                  <p className="text-xs text-muted-foreground">Definitions Created</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-accent/30">
                  <p className="text-2xl font-bold">{importResult.aiMappingsApplied}</p>
                  <p className="text-xs text-muted-foreground">AI Mappings</p>
                </div>
              </div>

              {importResult.definitions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Created Definitions:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {importResult.definitions.map((def) => (
                      <div
                        key={def.id}
                        className="flex items-center gap-2 text-sm p-2 rounded bg-accent/20"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium">{def.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {def.fileAName} ↔ {def.fileBName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Navigate to the Definitions tab to review field mappings and start reconciliation.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
