"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { createDefinitionAction } from "@/actions/definitions-actions"
import { getFilesForProjectAction } from "@/actions/files-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { UploadedFile } from "@/db/schema/uploaded-files-schema"

interface KeyFieldPair {
  fieldA: string
  fieldB: string
}

export default function NewDefinitionPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const router = useRouter()
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [sourceAFileId, setSourceAFileId] = useState("")
  const [sourceBFileId, setSourceBFileId] = useState("")
  const [keyFields, setKeyFields] = useState<KeyFieldPair[]>([
    { fieldA: "", fieldB: "" }
  ])

  const loadFiles = useCallback(async () => {
    const result = await getFilesForProjectAction(projectId)
    if (result.status === "success") setFiles(result.data)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const sourceAFiles = files.filter(f => f.fileRole === "source_a")
  const sourceBFiles = files.filter(f => f.fileRole === "source_b")

  const selectedFileA = files.find(f => f.id === sourceAFileId)
  const selectedFileB = files.find(f => f.id === sourceBFileId)

  const headersA = Array.isArray(selectedFileA?.parsedHeaders)
    ? (selectedFileA.parsedHeaders as string[])
    : []
  const headersB = Array.isArray(selectedFileB?.parsedHeaders)
    ? (selectedFileB.parsedHeaders as string[])
    : []

  function addKeyField() {
    setKeyFields([...keyFields, { fieldA: "", fieldB: "" }])
  }

  function removeKeyField(index: number) {
    setKeyFields(keyFields.filter((_, i) => i !== index))
  }

  function updateKeyField(
    index: number,
    field: "fieldA" | "fieldB",
    value: string
  ) {
    const updated = [...keyFields]
    updated[index] = { ...updated[index], [field]: value }
    setKeyFields(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Definition name is required")
      return
    }

    setIsSubmitting(true)
    try {
      const validKeyFields = keyFields.filter(kf => kf.fieldA && kf.fieldB)

      const result = await createDefinitionAction({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        sourceAFileId: sourceAFileId || undefined,
        sourceBFileId: sourceBFileId || undefined,
        keyFields: validKeyFields
      })

      if (result.status === "success") {
        toast.success("Definition created successfully")
        router.push(
          `/dashboard/projects/${projectId}/definitions/${result.data.id}`
        )
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to create definition")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">
      <Link
        href={`/dashboard/projects/${projectId}/definitions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Definitions
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Definition</h2>
        <p className="mt-1 text-muted-foreground">
          Define how two data sources should be compared
        </p>
      </div>

      <Card className="glass-card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Trade Position Reconciliation"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this definition reconciles..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* Source Files */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source A File</Label>
              {loading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select value={sourceAFileId} onValueChange={(v: string | null) => setSourceAFileId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Source A file" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAFiles.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.filename}
                      </SelectItem>
                    ))}
                    {sourceAFiles.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No Source A files uploaded
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Source B File</Label>
              {loading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select value={sourceBFileId} onValueChange={(v: string | null) => setSourceBFileId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Source B file" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceBFiles.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.filename}
                      </SelectItem>
                    ))}
                    {sourceBFiles.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No Source B files uploaded
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Key Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Key Fields</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addKeyField}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Key
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Key fields are used to match rows between the two sources
            </p>

            <div className="space-y-2">
              {keyFields.map((kf, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2"
                >
                  <Select
                    value={kf.fieldA}
                    onValueChange={(v: string | null) => updateKeyField(index, "fieldA", v ?? "")}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Field A" />
                    </SelectTrigger>
                    <SelectContent>
                      {headersA.map(h => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-muted-foreground text-sm">=</span>

                  <Select
                    value={kf.fieldB}
                    onValueChange={(v: string | null) => updateKeyField(index, "fieldB", v ?? "")}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Field B" />
                    </SelectTrigger>
                    <SelectContent>
                      {headersB.map(h => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {keyFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKeyField(index)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Definition
            </Button>
            <Link
              href={`/dashboard/projects/${projectId}/definitions`}
            >
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
