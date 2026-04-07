"use client"

import { useState, useEffect, useCallback, use } from "react"
import {
  uploadFileAction,
  getFilesForProjectAction,
  getFilePreviewAction,
  deleteFileAction
} from "@/actions/files-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Upload,
  FileSpreadsheet,
  Eye,
  Trash2,
  Loader2,
  FileX2
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { UploadedFile } from "@/db/schema/uploaded-files-schema"

export default function FilesPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [fileRole, setFileRole] = useState("source_a")

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<{
    headers: string[]
    rows: Record<string, string>[]
    filename: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const loadFiles = useCallback(async () => {
    const result = await getFilesForProjectAction(projectId)
    if (result.status === "success") {
      setFiles(result.data)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return

    const file = fileList[0]
    const validTypes = [".csv", ".xml"]
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

    if (!validTypes.includes(ext)) {
      toast.error("Only .csv and .xml files are supported")
      return
    }

    setUploading(true)
    setUploadProgress(20)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("projectId", projectId)
      formData.append("fileRole", fileRole)

      setUploadProgress(50)

      const result = await uploadFileAction(formData)

      setUploadProgress(100)

      if (result.status === "success") {
        toast.success(`${file.name} uploaded successfully`)
        loadFiles()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to upload file")
    } finally {
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
      }, 500)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handlePreview(file: UploadedFile) {
    setPreviewLoading(true)
    setPreviewOpen(true)
    setPreviewData(null)

    const result = await getFilePreviewAction(file.id, 50)
    if (result.status === "success") {
      setPreviewData({
        headers: result.data.headers,
        rows: result.data.rows,
        filename: file.filename
      })
    } else {
      toast.error("Failed to load file preview")
      setPreviewOpen(false)
    }
    setPreviewLoading(false)
  }

  async function handleDelete(fileId: string, filename: string) {
    const result = await deleteFileAction(fileId)
    if (result.status === "success") {
      toast.success(`${filename} deleted`)
      loadFiles()
    } else {
      toast.error(result.message)
    }
  }

  const roleBadge = (role: string) => {
    switch (role) {
      case "source_a":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Source A</Badge>
      case "source_b":
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Source B</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Upload Zone */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold">Upload File</h3>
          <Select value={fileRole} onValueChange={(v: string | null) => setFileRole(v ?? "source_a")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="source_a">Source A</SelectItem>
              <SelectItem value="source_b">Source B</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-all duration-200 cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5 glow-blue"
              : "border-border/50 hover:border-primary/40 hover:bg-accent/20",
            uploading && "pointer-events-none opacity-60"
          )}
          onClick={() => {
            if (!uploading) {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = ".csv,.xml"
              input.onchange = e =>
                handleFileUpload((e.target as HTMLInputElement).files)
              input.click()
            }
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium">Uploading...</p>
              <div className="w-48 h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Drag & drop a file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .csv and .xml files
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Files Table */}
      <Card className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-lg font-semibold">Uploaded Files</h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <FileX2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No files uploaded yet
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Headers</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map(file => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{file.filename}</span>
                    </div>
                  </TableCell>
                  <TableCell>{roleBadge(file.fileRole)}</TableCell>
                  <TableCell>{file.rowCount ?? "-"}</TableCell>
                  <TableCell>
                    {Array.isArray(file.parsedHeaders)
                      ? (file.parsedHeaders as string[]).length
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(file.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(file)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(file.id, file.filename)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {previewData
                ? `Preview: ${previewData.filename}`
                : "Loading preview..."}
            </DialogTitle>
          </DialogHeader>

          {previewLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : previewData ? (
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-background w-12">
                      #
                    </TableHead>
                    {previewData.headers.map(h => (
                      <TableHead
                        key={h}
                        className="sticky top-0 bg-background whitespace-nowrap"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">
                        {i + 1}
                      </TableCell>
                      {previewData.headers.map(h => (
                        <TableCell key={h} className="whitespace-nowrap">
                          {row[h] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
