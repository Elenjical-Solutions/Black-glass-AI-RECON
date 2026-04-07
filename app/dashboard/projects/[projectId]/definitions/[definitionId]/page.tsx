"use client"

import { useState, useEffect, useCallback, use } from "react"
import {
  getDefinitionByIdAction
} from "@/actions/definitions-actions"
import {
  saveFieldMappingsAction
} from "@/actions/field-mappings-actions"
import { getFilesForProjectAction, getFilePreviewAction } from "@/actions/files-actions"
import { suggestFieldMappingsAction } from "@/actions/ai-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  FileSpreadsheet,
  Key
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { FieldMapping } from "@/db/schema/field-mappings-schema"
import type { UploadedFile } from "@/db/schema/uploaded-files-schema"

interface MappingRow {
  id?: string
  fieldNameA: string
  fieldNameB: string
  matcherType: string
  tolerance: string
  toleranceType: string
  isKey: boolean
  sortOrder: number
}

export default function DefinitionDetailPage({
  params
}: {
  params: Promise<{ projectId: string; definitionId: string }>
}) {
  const { projectId, definitionId } = use(params)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [definitionName, setDefinitionName] = useState("")
  const [definitionDescription, setDefinitionDescription] = useState("")
  const [sourceAFileId, setSourceAFileId] = useState<string | null>(null)
  const [sourceBFileId, setSourceBFileId] = useState<string | null>(null)
  const [headersA, setHeadersA] = useState<string[]>([])
  const [headersB, setHeadersB] = useState<string[]>([])
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [files, setFiles] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const [defResult, filesResult] = await Promise.all([
      getDefinitionByIdAction(definitionId),
      getFilesForProjectAction(projectId)
    ])

    if (defResult.status === "success") {
      const def = defResult.data
      setDefinitionName(def.name)
      setDefinitionDescription(def.description ?? "")
      setSourceAFileId(def.sourceAFileId)
      setSourceBFileId(def.sourceBFileId)

      setMappings(
        def.fieldMappings.map((m: FieldMapping, i: number) => ({
          id: m.id,
          fieldNameA: m.fieldNameA,
          fieldNameB: m.fieldNameB,
          matcherType: m.matcherType,
          tolerance: m.tolerance ?? "",
          toleranceType: m.toleranceType ?? "absolute",
          isKey: m.isKey ?? false,
          sortOrder: m.sortOrder ?? i
        }))
      )
    }

    if (filesResult.status === "success") {
      setFiles(filesResult.data)
    }

    setLoading(false)
  }, [definitionId, projectId])

  // Load headers when files change
  useEffect(() => {
    if (sourceAFileId) {
      const fileA = files.find(f => f.id === sourceAFileId)
      if (fileA && Array.isArray(fileA.parsedHeaders)) {
        setHeadersA(fileA.parsedHeaders as string[])
      }
    }
    if (sourceBFileId) {
      const fileB = files.find(f => f.id === sourceBFileId)
      if (fileB && Array.isArray(fileB.parsedHeaders)) {
        setHeadersB(fileB.parsedHeaders as string[])
      }
    }
  }, [sourceAFileId, sourceBFileId, files])

  useEffect(() => {
    loadData()
  }, [loadData])

  function addMapping() {
    setMappings([
      ...mappings,
      {
        fieldNameA: "",
        fieldNameB: "",
        matcherType: "text",
        tolerance: "",
        toleranceType: "absolute",
        isKey: false,
        sortOrder: mappings.length
      }
    ])
  }

  function removeMapping(index: number) {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  function updateMapping(
    index: number,
    field: keyof MappingRow,
    value: any
  ) {
    const updated = [...mappings]
    updated[index] = { ...updated[index], [field]: value }
    setMappings(updated)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await saveFieldMappingsAction(
        definitionId,
        mappings.map((m, i) => ({
          fieldNameA: m.fieldNameA,
          fieldNameB: m.fieldNameB,
          matcherType: m.matcherType,
          tolerance: m.tolerance || undefined,
          toleranceType: m.matcherType === "number" ? m.toleranceType : undefined,
          isKey: m.isKey,
          sortOrder: i
        }))
      )

      if (result.status === "success") {
        toast.success("Field mappings saved")
        // Update IDs from saved data
        setMappings(
          result.data.map((m, i) => ({
            id: m.id,
            fieldNameA: m.fieldNameA,
            fieldNameB: m.fieldNameB,
            matcherType: m.matcherType,
            tolerance: m.tolerance ?? "",
            toleranceType: m.toleranceType ?? "absolute",
            isKey: m.isKey ?? false,
            sortOrder: m.sortOrder ?? i
          }))
        )
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to save mappings")
    } finally {
      setSaving(false)
    }
  }

  async function handleAISuggest() {
    if (headersA.length === 0 || headersB.length === 0) {
      toast.error("Both source files must be selected with parsed headers")
      return
    }

    setSuggesting(true)
    try {
      // Get sample rows for better suggestions
      let sampleA: Record<string, string>[] | undefined
      let sampleB: Record<string, string>[] | undefined

      if (sourceAFileId) {
        const previewA = await getFilePreviewAction(sourceAFileId, 5)
        if (previewA.status === "success") sampleA = previewA.data.rows
      }
      if (sourceBFileId) {
        const previewB = await getFilePreviewAction(sourceBFileId, 5)
        if (previewB.status === "success") sampleB = previewB.data.rows
      }

      const result = await suggestFieldMappingsAction(
        headersA,
        headersB,
        sampleA,
        sampleB
      )

      if (result.status === "success") {
        const suggested = result.data.map((s, i) => ({
          fieldNameA: s.fieldA,
          fieldNameB: s.fieldB,
          matcherType: s.matcherType ?? "text",
          tolerance: s.suggestedTolerance?.toString() ?? "",
          toleranceType: "absolute",
          isKey: false,
          sortOrder: i
        }))
        setMappings(suggested)
        toast.success(`AI suggested ${suggested.length} field mappings`)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("AI suggestion failed")
    } finally {
      setSuggesting(false)
    }
  }

  const fileNameA = files.find(f => f.id === sourceAFileId)?.filename
  const fileNameB = files.find(f => f.id === sourceBFileId)?.filename

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link
        href={`/dashboard/projects/${projectId}/definitions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Definitions
      </Link>

      {/* Definition Info */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{definitionName}</h2>
            {definitionDescription && (
              <p className="mt-1 text-sm text-muted-foreground">
                {definitionDescription}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              {fileNameA && (
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                  Source A: {fileNameA}
                </span>
              )}
              {fileNameB && (
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                  Source B: {fileNameB}
                </span>
              )}
            </div>
          </div>
          <Badge variant="secondary">
            {mappings.length} mapping{mappings.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </Card>

      {/* Field Mapping Editor */}
      <Card className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h3 className="text-lg font-semibold">Field Mappings</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleAISuggest}
              disabled={suggesting}
            >
              {suggesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI Suggest Mappings
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={addMapping}
            >
              <Plus className="h-4 w-4" />
              Add Mapping
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {mappings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No field mappings yet. Add mappings manually or use AI to suggest
              them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File A Field</TableHead>
                  <TableHead>File B Field</TableHead>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Tolerance</TableHead>
                  <TableHead>Tolerance Type</TableHead>
                  <TableHead className="w-16 text-center">
                    <Key className="h-3.5 w-3.5 mx-auto" />
                  </TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={m.fieldNameA}
                        onValueChange={(v: string | null) =>
                          updateMapping(index, "fieldNameA", v ?? "")
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {headersA.map(h => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.fieldNameB}
                        onValueChange={(v: string | null) =>
                          updateMapping(index, "fieldNameB", v ?? "")
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {headersB.map(h => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.matcherType}
                        onValueChange={(v: string | null) =>
                          updateMapping(index, "matcherType", v ?? "text")
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="regex">Regex</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {m.matcherType === "number" ? (
                        <Input
                          type="number"
                          step="any"
                          placeholder="0"
                          className="w-24"
                          value={m.tolerance}
                          onChange={e =>
                            updateMapping(index, "tolerance", e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.matcherType === "number" ? (
                        <Select
                          value={m.toleranceType}
                          onValueChange={(v: string | null) =>
                            updateMapping(index, "toleranceType", v ?? "absolute")
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="absolute">Absolute</SelectItem>
                            <SelectItem value="percentage">
                              Percentage
                            </SelectItem>
                            <SelectItem value="basis_points">
                              Basis Points
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={m.isKey}
                        onCheckedChange={v =>
                          updateMapping(index, "isKey", !!v)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMapping(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
