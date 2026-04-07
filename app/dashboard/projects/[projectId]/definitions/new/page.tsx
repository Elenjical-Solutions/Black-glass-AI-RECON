"use client"

import { useState, useEffect, useCallback, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { createDefinitionAction } from "@/actions/definitions-actions"
import { getFilesForProjectAction, uploadFileAction } from "@/actions/files-actions"
import { saveFieldMappingsAction } from "@/actions/field-mappings-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft, Loader2, Plus, Trash2, FileSpreadsheet, Upload,
  ArrowRight, Check, Sparkles
} from "lucide-react"
import { suggestFieldMappingsAction } from "@/actions/ai-actions"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"
import Papa from "papaparse"

interface KeyFieldPair {
  fieldA: string
  fieldB: string
}

interface FieldMappingRow {
  fieldA: string
  fieldB: string
  matcherType: string
  tolerance: string
  toleranceType: string
  isKey: boolean
}

type FileSource = "upload" | "existing"

export default function NewDefinitionPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const router = useRouter()
  const fileARef = useRef<HTMLInputElement>(null)
  const fileBRef = useRef<HTMLInputElement>(null)

  // Existing files from DB
  const [existingFiles, setExistingFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)

  // File source mode
  const [fileSourceMode, setFileSourceMode] = useState<FileSource>("upload")

  // Upload mode: local files picked by user
  const [localFileA, setLocalFileA] = useState<File | null>(null)
  const [localFileB, setLocalFileB] = useState<File | null>(null)
  const [headersA, setHeadersA] = useState<string[]>([])
  const [headersB, setHeadersB] = useState<string[]>([])
  const [previewA, setPreviewA] = useState<Record<string, string>[]>([])
  const [previewB, setPreviewB] = useState<Record<string, string>[]>([])

  // Existing mode: pick from DB
  const [existingFileAId, setExistingFileAId] = useState("")
  const [existingFileBId, setExistingFileBId] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [department, setDepartment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step tracking
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1=files, 2=mappings, 3=review

  // Field mappings (auto-generated from headers)
  const [mappings, setMappings] = useState<FieldMappingRow[]>([])
  const [aiSuggesting, setAiSuggesting] = useState(false)

  const loadExistingFiles = useCallback(async () => {
    const result = await getFilesForProjectAction(projectId)
    if (result.status === "success") setExistingFiles(result.data)
    setLoadingFiles(false)
  }, [projectId])

  useEffect(() => { loadExistingFiles() }, [loadExistingFiles])

  // When existing file is selected, load its headers
  useEffect(() => {
    if (fileSourceMode !== "existing") return
    const fA = existingFiles.find(f => f.id === existingFileAId)
    const fB = existingFiles.find(f => f.id === existingFileBId)
    setHeadersA(Array.isArray(fA?.parsedHeaders) ? fA.parsedHeaders as string[] : [])
    setHeadersB(Array.isArray(fB?.parsedHeaders) ? fB.parsedHeaders as string[] : [])
  }, [existingFileAId, existingFileBId, existingFiles, fileSourceMode])

  // Parse a local CSV file for headers + preview
  function parseLocalFile(file: File, side: "A" | "B") {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        preview: 5 // Only parse first 5 rows for preview
      })
      const headers = result.meta.fields ?? []
      if (side === "A") {
        setHeadersA(headers)
        setPreviewA(result.data.slice(0, 3))
      } else {
        setHeadersB(headers)
        setPreviewB(result.data.slice(0, 3))
      }
    }
    reader.readAsText(file)
  }

  function handleFileAPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalFileA(file)
    parseLocalFile(file, "A")
  }

  function handleFileBPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalFileB(file)
    parseLocalFile(file, "B")
  }

  // Auto-generate field mappings from headers
  function generateMappings() {
    if (headersA.length === 0) {
      toast.error("No headers detected from Source A")
      return
    }

    const newMappings: FieldMappingRow[] = []
    const usedB = new Set<string>()

    for (const hA of headersA) {
      const hALower = hA.toLowerCase().replace(/[\s_-]/g, "")
      // Find exact or fuzzy match in B
      let matchB = headersB.find(hB => hB === hA)
      if (!matchB) {
        matchB = headersB.find(hB => {
          const hBLower = hB.toLowerCase().replace(/[\s_-]/g, "")
          return hBLower === hALower && !usedB.has(hB)
        })
      }

      const isNumeric = ["market_value", "pnl", "notional", "past_cash", "future_cash",
        "settled_cash", "future_pnl", "dv01", "dv01_par", "dv01_zero", "ir_vega",
        "eq_delta", "eq_vega", "eq_theta", "fx_delta", "fx_vega", "fx_theta", "fx_gamma",
        "com_delta", "com_vega", "risk_weight", "sensitivity_bucket"
      ].some(n => hALower.includes(n.replace(/_/g, "")))

      const isKey = ["trade_id", "tradeid", "portfolio"].some(k => hALower.includes(k.replace(/_/g, "")))

      newMappings.push({
        fieldA: hA,
        fieldB: matchB ?? hA,
        matcherType: isNumeric ? "number" : "text",
        tolerance: isNumeric ? "0.01" : "",
        toleranceType: isNumeric ? "absolute" : "",
        isKey,
      })

      if (matchB) usedB.add(matchB)
    }

    setMappings(newMappings)
    setStep(2)
    toast.success(`Auto-mapped ${newMappings.length} fields (${newMappings.filter(m => m.isKey).length} keys)`)
  }

  async function handleAiSuggestMappings() {
    if (headersA.length === 0 || headersB.length === 0) {
      toast.error("Both files must have detected headers")
      return
    }

    setAiSuggesting(true)
    try {
      const result = await suggestFieldMappingsAction(
        headersA,
        headersB,
        previewA.length > 0 ? previewA : undefined,
        previewB.length > 0 ? previewB : undefined
      )

      if (result.status === "success" && result.data.length > 0) {
        const aiMappings: FieldMappingRow[] = result.data.map(m => ({
          fieldA: m.fieldA,
          fieldB: m.fieldB,
          matcherType: m.matcherType || "text",
          tolerance: m.suggestedTolerance?.toString() ?? (m.matcherType === "number" ? "0.01" : ""),
          toleranceType: m.matcherType === "number" ? "absolute" : "",
          isKey: false,
        }))

        // Mark likely key fields
        for (const m of aiMappings) {
          const lower = m.fieldA.toLowerCase().replace(/[\s_-]/g, "")
          if (["tradeid", "portfolio", "bookid"].some(k => lower.includes(k))) {
            m.isKey = true
          }
        }

        setMappings(aiMappings)
        setStep(2)

        const avgConfidence = Math.round(
          result.data.reduce((sum, m) => sum + (m.confidence || 0), 0) / result.data.length
        )
        toast.success(
          `AI mapped ${aiMappings.length} fields with avg ${avgConfidence}% confidence`
        )
      } else {
        toast.error(result.status === "error" ? result.message : "No mappings returned")
      }
    } catch {
      toast.error("AI field mapping suggestion failed")
    } finally {
      setAiSuggesting(false)
    }
  }

  function updateMapping(index: number, field: keyof FieldMappingRow, value: any) {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function removeMapping(index: number) {
    setMappings(prev => prev.filter((_, i) => i !== index))
  }

  function addMapping() {
    setMappings(prev => [...prev, {
      fieldA: "", fieldB: "", matcherType: "text", tolerance: "", toleranceType: "", isKey: false
    }])
  }

  const hasFiles = fileSourceMode === "upload"
    ? (localFileA !== null && localFileB !== null)
    : (existingFileAId !== "" && existingFileBId !== "")

  const canProceedToMapping = hasFiles && headersA.length > 0

  // Submit: upload files if needed, create definition, save mappings
  async function handleSubmit() {
    if (!name.trim()) { toast.error("Name is required"); return }
    setIsSubmitting(true)

    try {
      let fileAId: string | undefined
      let fileBId: string | undefined

      if (fileSourceMode === "upload" && localFileA && localFileB) {
        // Upload both files to DB
        toast.info("Uploading files...")
        const fdA = new FormData()
        fdA.append("file", localFileA)
        fdA.append("projectId", projectId)
        fdA.append("fileRole", "source_a")
        const resA = await uploadFileAction(fdA)
        if (resA.status === "error") throw new Error(`File A upload: ${resA.message}`)
        fileAId = resA.data.id

        const fdB = new FormData()
        fdB.append("file", localFileB)
        fdB.append("projectId", projectId)
        fdB.append("fileRole", "source_b")
        const resB = await uploadFileAction(fdB)
        if (resB.status === "error") throw new Error(`File B upload: ${resB.message}`)
        fileBId = resB.data.id
      } else if (fileSourceMode === "existing") {
        fileAId = existingFileAId || undefined
        fileBId = existingFileBId || undefined
      }

      // Create definition
      toast.info("Creating template...")
      const keyFieldMappings = mappings.filter(m => m.isKey)
      const defResult = await createDefinitionAction({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        sourceAFileId: fileAId,
        sourceBFileId: fileBId,
        category: category || undefined,
        department: department || undefined,
        keyFields: keyFieldMappings.map(m => ({ fieldA: m.fieldA, fieldB: m.fieldB })),
      })

      if (defResult.status === "error") throw new Error(defResult.message)
      const defId = defResult.data.id

      // Save field mappings
      if (mappings.length > 0) {
        toast.info("Saving field mappings...")
        const mappingData = mappings.map((m, i) => ({
          fieldNameA: m.fieldA,
          fieldNameB: m.fieldB,
          matcherType: m.matcherType,
          tolerance: m.tolerance || undefined,
          toleranceType: m.toleranceType || undefined,
          isKey: m.isKey,
          sortOrder: i,
        }))
        const mapResult = await saveFieldMappingsAction(defId, mappingData)
        if (mapResult.status === "error") {
          toast.error(`Mappings: ${mapResult.message}`)
        }
      }

      toast.success("Recon template created with field mappings")
      router.push(`/dashboard/projects/${projectId}/definitions/${defId}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create definition")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6">
      <Link
        href={`/dashboard/projects/${projectId}/definitions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Definitions
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Recon Template</h2>
        <p className="mt-1 text-muted-foreground">
          Select two files, auto-detect columns, configure field mappings, and save as a reusable template.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: "Select Files" },
          { num: 2, label: "Map Fields" },
          { num: 3, label: "Name & Save" },
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => { if (s.num <= step) setStep(s.num as 1 | 2 | 3) }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              step === s.num ? "bg-primary text-primary-foreground" :
              step > s.num ? "bg-primary/20 text-primary cursor-pointer" :
              "bg-muted text-muted-foreground"
            )}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-background/20">
              {step > s.num ? <Check className="h-3 w-3" /> : s.num}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: File Selection */}
      {step === 1 && (
        <Card className="glass-card p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Select Files to Compare</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload new files from your machine or pick from previously uploaded files.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={fileSourceMode === "upload" ? "default" : "outline"}
              size="sm"
              onClick={() => setFileSourceMode("upload")}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload New Files
            </Button>
            <Button
              variant={fileSourceMode === "existing" ? "default" : "outline"}
              size="sm"
              onClick={() => setFileSourceMode("existing")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Use Existing Files
            </Button>
          </div>

          {fileSourceMode === "upload" ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {/* File A upload */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Source A (Old / Before)
                </Label>
                <input ref={fileARef} type="file" accept=".csv,.xml,.tsv" className="hidden" onChange={handleFileAPick} />
                <div
                  onClick={() => fileARef.current?.click()}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-all",
                    localFileA ? "border-blue-500/40 bg-blue-500/5" : "border-border/50 hover:border-primary/40"
                  )}
                >
                  {localFileA ? (
                    <>
                      <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                      <p className="text-sm font-medium">{localFileA.name}</p>
                      <p className="text-xs text-muted-foreground">{headersA.length} columns detected</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to select Source A file</p>
                      <p className="text-xs text-muted-foreground">.csv, .xml, .tsv</p>
                    </>
                  )}
                </div>
                {previewA.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Preview: {headersA.slice(0, 5).join(", ")}{headersA.length > 5 && ` +${headersA.length - 5} more`}
                  </div>
                )}
              </div>

              {/* File B upload */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  Source B (New / After)
                </Label>
                <input ref={fileBRef} type="file" accept=".csv,.xml,.tsv" className="hidden" onChange={handleFileBPick} />
                <div
                  onClick={() => fileBRef.current?.click()}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-all",
                    localFileB ? "border-cyan-500/40 bg-cyan-500/5" : "border-border/50 hover:border-primary/40"
                  )}
                >
                  {localFileB ? (
                    <>
                      <FileSpreadsheet className="h-8 w-8 text-cyan-400 mb-2" />
                      <p className="text-sm font-medium">{localFileB.name}</p>
                      <p className="text-xs text-muted-foreground">{headersB.length} columns detected</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to select Source B file</p>
                      <p className="text-xs text-muted-foreground">.csv, .xml, .tsv</p>
                    </>
                  )}
                </div>
                {previewB.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Preview: {headersB.slice(0, 5).join(", ")}{headersB.length > 5 && ` +${headersB.length - 5} more`}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Source A
                </Label>
                <Select value={existingFileAId} onValueChange={(v) => v && setExistingFileAId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select file..." /></SelectTrigger>
                  <SelectContent>
                    {existingFiles.filter(f => f.fileRole === "source_a").map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.filename} ({f.rowCount} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  Source B
                </Label>
                <Select value={existingFileBId} onValueChange={(v) => v && setExistingFileBId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select file..." /></SelectTrigger>
                  <SelectContent>
                    {existingFiles.filter(f => f.fileRole === "source_b").map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.filename} ({f.rowCount} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleAiSuggestMappings}
              disabled={!canProceedToMapping || aiSuggesting}
            >
              {aiSuggesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              AI Suggest Mappings
            </Button>
            <Button onClick={generateMappings} disabled={!canProceedToMapping}>
              Auto-Detect Columns & Map
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Field Mappings */}
      {step === 2 && (
        <Card className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Field Mappings</h3>
              <p className="text-sm text-muted-foreground">
                {mappings.length} fields mapped. Mark key fields for row matching. Set match type and tolerance.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Field
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Key</TableHead>
                  <TableHead>Source A Field</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Source B Field</TableHead>
                  <TableHead className="w-28">Match Type</TableHead>
                  <TableHead className="w-24">Tolerance</TableHead>
                  <TableHead className="w-28">Tol. Type</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m, i) => (
                  <TableRow key={i} className={cn(m.isKey && "bg-primary/5")}>
                    <TableCell>
                      <Checkbox checked={m.isKey} onCheckedChange={(v) => updateMapping(i, "isKey", !!v)} />
                    </TableCell>
                    <TableCell>
                      {headersA.length > 0 ? (
                        <Select value={m.fieldA} onValueChange={(v) => v && updateMapping(i, "fieldA", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {headersA.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={m.fieldA} onChange={e => updateMapping(i, "fieldA", e.target.value)} className="h-8 text-xs" />
                      )}
                    </TableCell>
                    <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                    <TableCell>
                      {headersB.length > 0 ? (
                        <Select value={m.fieldB} onValueChange={(v) => v && updateMapping(i, "fieldB", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {headersB.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={m.fieldB} onChange={e => updateMapping(i, "fieldB", e.target.value)} className="h-8 text-xs" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={m.matcherType} onValueChange={(v) => v && updateMapping(i, "matcherType", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                        <Input type="number" step="any" value={m.tolerance}
                          onChange={e => updateMapping(i, "tolerance", e.target.value)}
                          className="h-8 text-xs" placeholder="0.01" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.matcherType === "number" ? (
                        <Select value={m.toleranceType || "absolute"} onValueChange={(v) => v && updateMapping(i, "toleranceType", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="absolute">Absolute</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="basis_points">Basis Pts</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeMapping(i)} className="text-destructive h-8 w-8 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Files
            </Button>
            <Button onClick={() => setStep(3)} disabled={mappings.length === 0}>
              Name & Save
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Name & Save */}
      {step === 3 && (
        <Card className="glass-card p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Name & Save Template</h3>
            <p className="text-sm text-muted-foreground">
              Give your recon template a name. Files will be uploaded and field mappings saved.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Template Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g., Core Trade Reconciliation"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this template reconciles..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core Reconciliation</SelectItem>
                  <SelectItem value="sensitivity">Sensitivity</SelectItem>
                  <SelectItem value="downstream">Downstream Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department / Asset Class</Label>
              <Input placeholder="e.g., IR, FX, Market Risk" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-medium">Summary</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
              <span>Source A:</span>
              <span className="text-foreground">{localFileA?.name ?? existingFiles.find(f => f.id === existingFileAId)?.filename ?? "—"}</span>
              <span>Source B:</span>
              <span className="text-foreground">{localFileB?.name ?? existingFiles.find(f => f.id === existingFileBId)?.filename ?? "—"}</span>
              <span>Fields mapped:</span>
              <span className="text-foreground">{mappings.length}</span>
              <span>Key fields:</span>
              <span className="text-foreground">{mappings.filter(m => m.isKey).map(m => m.fieldA).join(", ") || "—"}</span>
              <span>Numeric fields:</span>
              <span className="text-foreground">{mappings.filter(m => m.matcherType === "number").length}</span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Mappings
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
              Create Template
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
