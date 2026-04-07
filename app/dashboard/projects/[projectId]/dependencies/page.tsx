"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import {
  getDependencyGraphWithStatsAction,
  getExplanationFlowAction,
  addDependencyEdgeAction,
  removeDependencyEdgeAction,
  propagateDependenciesAction
} from "@/actions/dependency-actions"
import { getCyclesForProjectAction } from "@/actions/cycles-actions"
import { TreeBrowser } from "@/components/dependency/tree-browser"
import { LineageVisualizer } from "@/components/dependency/lineage-visualizer"
import { DefinitionSummaryPanel } from "@/components/dependency/definition-summary-panel"
import { FilterBar, type FilterState } from "@/components/dependency/filter-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Plus,
  Loader2,
  GitBranch,
  Zap,
  X,
  Settings2
} from "lucide-react"
import { toast } from "sonner"
import type { DefinitionWithStats } from "@/components/dependency/tree-browser"

interface FieldMapping {
  parentField: string
  childField: string
}

export default function DependenciesPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const router = useRouter()

  // Data state
  const [definitions, setDefinitions] = useState<DefinitionWithStats[]>([])
  const [depEdges, setDepEdges] = useState<Array<{
    id: string; parentDefinitionId: string; childDefinitionId: string; propagationRule: any
  }>>([])
  const [loading, setLoading] = useState(true)
  const [latestCycleId, setLatestCycleId] = useState<string | null>(null)

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [explanationFlow, setExplanationFlow] = useState<any>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    categories: ["core", "sensitivity", "downstream"],
    departments: [],
    status: "all"
  })

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [parentDefId, setParentDefId] = useState("")
  const [childDefId, setChildDefId] = useState("")
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { parentField: "", childField: "" }
  ])
  const [toleranceOverride, setToleranceOverride] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [propagating, setPropagating] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    const cyclesResult = await getCyclesForProjectAction(projectId)
    let cycleId: string | undefined
    if (cyclesResult.status === "success" && cyclesResult.data.length > 0) {
      const sorted = [...cyclesResult.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      cycleId = sorted[0].id
      setLatestCycleId(cycleId)
    }

    const graphResult = await getDependencyGraphWithStatsAction(projectId, cycleId)
    if (graphResult.status === "success") {
      setDefinitions(graphResult.data.nodes as any)
      setDepEdges(graphResult.data.edges)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  // Load explanation flow when selection changes
  useEffect(() => {
    if (!selectedId) {
      setExplanationFlow(null)
      return
    }
    const def = definitions.find(d => d.id === selectedId)
    if (!def?.runId) {
      setExplanationFlow(null)
      return
    }
    setExplanationLoading(true)
    getExplanationFlowAction(def.runId).then(result => {
      if (result.status === "success") {
        setExplanationFlow(result.data)
      }
      setExplanationLoading(false)
    })
  }, [selectedId, definitions])

  // Derived data
  const availableDepartments = [...new Set(
    definitions.map(d => d.department).filter(Boolean) as string[]
  )].sort()

  const selectedDef = definitions.find(d => d.id === selectedId) ?? null

  // Handlers
  function handleNavigateToResults(runId: string) {
    if (!latestCycleId) return
    router.push(`/dashboard/projects/${projectId}/cycles/${latestCycleId}/runs/${runId}`)
  }

  async function handlePropagateAll() {
    if (!latestCycleId) {
      toast.error("No cycle available")
      return
    }
    setPropagating(true)
    const result = await propagateDependenciesAction(latestCycleId)
    setPropagating(false)
    if (result.status === "success") {
      toast.success(`Propagated ${result.data.propagatedCount} explanation(s)`)
      loadData()
    } else {
      toast.error(result.message)
    }
  }

  async function handleAddDependency() {
    if (!parentDefId || !childDefId) {
      toast.error("Select both parent and child")
      return
    }
    if (parentDefId === childDefId) {
      toast.error("Parent and child must be different")
      return
    }
    setSubmitting(true)
    const validMappings = fieldMappings.filter(m => m.parentField.trim() && m.childField.trim())
    const result = await addDependencyEdgeAction({
      projectId,
      parentDefinitionId: parentDefId,
      childDefinitionId: childDefId,
      propagationRule: validMappings.length > 0 || toleranceOverride
        ? { fieldMappings: validMappings, toleranceOverride: toleranceOverride ? parseFloat(toleranceOverride) : undefined }
        : undefined
    })
    setSubmitting(false)
    if (result.status === "success") {
      toast.success("Dependency added")
      setAddDialogOpen(false)
      setParentDefId("")
      setChildDefId("")
      setFieldMappings([{ parentField: "", childField: "" }])
      setToleranceOverride("")
      loadData()
    } else {
      toast.error(result.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] gap-0">
        <div className="w-[280px] border-r border-border/50 p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <div className="w-[320px] border-l border-border/50 p-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (definitions.length === 0) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center h-[60vh]">
        <div className="rounded-full bg-muted p-4 mb-4">
          <GitBranch className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No Definitions Yet</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm text-center">
          Create reconciliation definitions first, then define dependencies between them.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Dependency Command Center</span>
          <Badge variant="outline" className="text-xs">
            {definitions.length} definitions &middot; {depEdges.length} edges
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={handlePropagateAll}
            disabled={propagating || !latestCycleId}
          >
            {propagating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            Propagate All
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Dependency
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tree Browser */}
        <div className="w-[280px] border-r border-border/50 flex flex-col bg-sidebar/50">
          <div className="p-3 border-b border-border/30">
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              availableDepartments={availableDepartments}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <TreeBrowser
              definitions={definitions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filters={filters}
            />
          </div>
        </div>

        {/* Center: Lineage Visualizer */}
        <div className="flex-1 overflow-hidden">
          <LineageVisualizer
            definitions={definitions}
            edges={depEdges}
            selectedId={selectedId}
            onNodeClick={setSelectedId}
          />
        </div>

        {/* Right: Summary Panel */}
        <div className="w-[320px] border-l border-border/50 overflow-y-auto bg-sidebar/30">
          <DefinitionSummaryPanel
            definition={selectedDef}
            explanationFlow={explanationLoading ? null : explanationFlow}
            projectId={projectId}
            cycleId={latestCycleId}
            onNavigateToResults={handleNavigateToResults}
            onEdgeAdded={loadData}
          />
        </div>
      </div>

      {/* Add Dependency Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Add Dependency Edge</DialogTitle>
            <DialogDescription>
              Define a dependency for explanation key propagation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Parent (Upstream)</Label>
              <Select value={parentDefId} onValueChange={(v) => v && setParentDefId(v)}>
                <SelectTrigger><SelectValue placeholder="Select parent..." /></SelectTrigger>
                <SelectContent>
                  {definitions.filter(d => d.category === "core" || d.category === "sensitivity").map(def => (
                    <SelectItem key={def.id} value={def.id}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${def.category === "core" ? "bg-blue-500" : "bg-purple-500"}`} />
                        {def.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Child (Downstream)</Label>
              <Select value={childDefId} onValueChange={(v) => v && setChildDefId(v)}>
                <SelectTrigger><SelectValue placeholder="Select child..." /></SelectTrigger>
                <SelectContent>
                  {definitions.map(def => (
                    <SelectItem key={def.id} value={def.id}>{def.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Field Mappings</Label>
                <Button variant="ghost" size="sm" onClick={() => setFieldMappings(prev => [...prev, { parentField: "", childField: "" }])}>
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
              {fieldMappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Parent field" value={m.parentField}
                    onChange={e => setFieldMappings(prev => prev.map((fm, idx) => idx === i ? { ...fm, parentField: e.target.value } : fm))}
                    className="flex-1 text-xs" />
                  <span className="text-muted-foreground text-xs">&rarr;</span>
                  <Input placeholder="Child field" value={m.childField}
                    onChange={e => setFieldMappings(prev => prev.map((fm, idx) => idx === i ? { ...fm, childField: e.target.value } : fm))}
                    className="flex-1 text-xs" />
                  {fieldMappings.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setFieldMappings(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Tolerance Override (optional)</Label>
              <Input type="number" step="any" placeholder="e.g. 0.01" value={toleranceOverride}
                onChange={e => setToleranceOverride(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDependency} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Add Edge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
