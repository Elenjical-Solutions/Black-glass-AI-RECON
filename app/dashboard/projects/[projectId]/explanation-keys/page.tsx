"use client"

import { useState, useEffect, useCallback, use } from "react"
import {
  getExplanationKeysAction,
  createExplanationKeyAction,
  updateExplanationKeyAction,
  deleteExplanationKeyAction
} from "@/actions/explanation-keys-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Loader2, Key } from "lucide-react"
import { toast } from "sonner"
import type { ExplanationKey } from "@/db/schema/explanation-keys-schema"

const PRESET_COLORS = [
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1"
]

interface FormState {
  code: string
  label: string
  description: string
  color: string
  naturalLanguageRule: string
  autoMatchFieldName: string
  autoMatchDiffMin: string
  autoMatchDiffMax: string
  autoMatchValueAPattern: string
  autoMatchValueBPattern: string
}

const emptyForm: FormState = {
  code: "",
  label: "",
  description: "",
  color: "#3b82f6",
  naturalLanguageRule: "",
  autoMatchFieldName: "",
  autoMatchDiffMin: "",
  autoMatchDiffMax: "",
  autoMatchValueAPattern: "",
  autoMatchValueBPattern: ""
}

export default function ExplanationKeysPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const [keys, setKeys] = useState<ExplanationKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadKeys = useCallback(async () => {
    const result = await getExplanationKeysAction(projectId)
    if (result.status === "success") setKeys(result.data)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(key: ExplanationKey) {
    setEditingId(key.id)
    const pattern = key.autoMatchPattern as any
    setForm({
      code: key.code,
      label: key.label,
      description: key.description ?? "",
      color: key.color ?? "#3b82f6",
      naturalLanguageRule: (key as any).naturalLanguageRule ?? "",
      autoMatchFieldName: pattern?.fieldName ?? "",
      autoMatchDiffMin: pattern?.diffRangeMin?.toString() ?? "",
      autoMatchDiffMax: pattern?.diffRangeMax?.toString() ?? "",
      autoMatchValueAPattern: pattern?.valueAPattern ?? "",
      autoMatchValueBPattern: pattern?.valueBPattern ?? ""
    })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.label.trim()) {
      toast.error("Code and label are required")
      return
    }

    setIsSubmitting(true)

    const autoMatchPattern: any = {}
    if (form.autoMatchFieldName) autoMatchPattern.fieldName = form.autoMatchFieldName
    if (form.autoMatchDiffMin) autoMatchPattern.diffRangeMin = parseFloat(form.autoMatchDiffMin)
    if (form.autoMatchDiffMax) autoMatchPattern.diffRangeMax = parseFloat(form.autoMatchDiffMax)
    if (form.autoMatchValueAPattern) autoMatchPattern.valueAPattern = form.autoMatchValueAPattern
    if (form.autoMatchValueBPattern) autoMatchPattern.valueBPattern = form.autoMatchValueBPattern

    try {
      if (editingId) {
        const result = await updateExplanationKeyAction(editingId, {
          code: form.code.trim(),
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          color: form.color,
          naturalLanguageRule: form.naturalLanguageRule.trim() || undefined,
          autoMatchPattern:
            Object.keys(autoMatchPattern).length > 0
              ? autoMatchPattern
              : undefined
        })
        if (result.status === "success") {
          toast.success("Explanation key updated")
          setDialogOpen(false)
          loadKeys()
        } else {
          toast.error(result.message)
        }
      } else {
        const result = await createExplanationKeyAction({
          projectId,
          code: form.code.trim(),
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          color: form.color,
          naturalLanguageRule: form.naturalLanguageRule.trim() || undefined,
          autoMatchPattern:
            Object.keys(autoMatchPattern).length > 0
              ? autoMatchPattern
              : undefined
        })
        if (result.status === "success") {
          toast.success("Explanation key created")
          setDialogOpen(false)
          loadKeys()
        } else {
          toast.error(result.message)
        }
      }
    } catch {
      toast.error("Operation failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteExplanationKeyAction(id)
    if (result.status === "success") {
      toast.success("Explanation key deleted")
      loadKeys()
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Explanation Keys</h3>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Key
        </Button>
      </div>

      {/* Table */}
      <Card className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="p-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4 inline-flex">
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No explanation keys</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Create explanation keys to categorize and explain reconciliation
              breaks.
            </p>
            <Button className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Auto-match Pattern</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map(key => (
                <TableRow key={key.id}>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {key.code}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium">{key.label}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {key.description ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      style={{
                        backgroundColor: `${key.color}20`,
                        color: key.color ?? undefined,
                        borderColor: `${key.color}40`
                      }}
                    >
                      {key.color ?? "default"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {key.autoMatchPattern
                      ? JSON.stringify(key.autoMatchPattern)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(key)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(key.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Explanation Key" : "New Explanation Key"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="FX_ROUNDING"
                  value={form.code}
                  onChange={e =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="FX Rounding Difference"
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe when this explanation applies..."
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                AI Rule (Natural Language)
                <Badge variant="outline" className="text-[10px] font-normal">For AI assignment</Badge>
              </Label>
              <Textarea
                placeholder="e.g., For basis swaps where the MV difference is below 1% of notional and maturity is less than 3 years, with DV01 shifting proportionally, this is the bootstrapping methodology change."
                value={form.naturalLanguageRule}
                onChange={e => setForm({ ...form, naturalLanguageRule: e.target.value })}
                rows={3}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Describe when this key should apply in plain English. AI reads this rule when assigning keys to breaks.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        form.color === c
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  ))}
                </div>
                <Input
                  className="w-24 ml-2"
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                  placeholder="#hex"
                />
              </div>
            </div>

            <div className="border-t border-border/50 pt-4">
              <h4 className="text-sm font-semibold mb-3">
                Auto-match Pattern (optional)
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Field Name</Label>
                  <Input
                    placeholder="e.g., notional_amount"
                    value={form.autoMatchFieldName}
                    onChange={e =>
                      setForm({ ...form, autoMatchFieldName: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Diff Range Min</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="-0.01"
                      value={form.autoMatchDiffMin}
                      onChange={e =>
                        setForm({ ...form, autoMatchDiffMin: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Diff Range Max</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.01"
                      value={form.autoMatchDiffMax}
                      onChange={e =>
                        setForm({ ...form, autoMatchDiffMax: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Value A Pattern (regex)</Label>
                    <Input
                      placeholder="^USD.*"
                      value={form.autoMatchValueAPattern}
                      onChange={e =>
                        setForm({
                          ...form,
                          autoMatchValueAPattern: e.target.value
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Value B Pattern (regex)</Label>
                    <Input
                      placeholder="^USD.*"
                      value={form.autoMatchValueBPattern}
                      onChange={e =>
                        setForm({
                          ...form,
                          autoMatchValueBPattern: e.target.value
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
