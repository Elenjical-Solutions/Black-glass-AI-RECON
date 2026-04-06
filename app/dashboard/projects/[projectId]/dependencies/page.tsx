"use client"

import { useState, useEffect, useCallback, useMemo, use } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import {
  getDependencyGraphAction,
  addDependencyEdgeAction,
  removeDependencyEdgeAction,
  propagateDependenciesAction
} from "@/actions/dependency-actions"
import { getCyclesForProjectAction } from "@/actions/cycles-actions"
import { getRunsForCycleAction } from "@/actions/runs-actions"
import {
  DependencyNode,
  type DependencyNodeData
} from "@/components/dependency/dependency-node"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
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
  Trash2,
  X
} from "lucide-react"
import { toast } from "sonner"
import type { ReconciliationDefinition } from "@/db/schema/definitions-schema"
import type { DependencyEdge } from "@/db/schema/dependency-edges-schema"
import type { ReconciliationRun } from "@/db/schema/runs-schema"

const nodeTypes = { dependency: DependencyNode }

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

  const [definitions, setDefinitions] = useState<ReconciliationDefinition[]>([])
  const [depEdges, setDepEdges] = useState<DependencyEdge[]>([])
  const [latestRuns, setLatestRuns] = useState<Record<string, ReconciliationRun>>({})
  const [loading, setLoading] = useState(true)
  const [propagating, setPropagating] = useState(false)
  const [latestCycleId, setLatestCycleId] = useState<string | null>(null)

  // Add dependency dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [parentDefId, setParentDefId] = useState("")
  const [childDefId, setChildDefId] = useState("")
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { parentField: "", childField: "" }
  ])
  const [toleranceOverride, setToleranceOverride] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Edge detail dialog state
  const [selectedEdge, setSelectedEdge] = useState<DependencyEdge | null>(null)
  const [edgeDetailOpen, setEdgeDetailOpen] = useState(false)

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const loadData = useCallback(async () => {
    const [graphResult, cyclesResult] = await Promise.all([
      getDependencyGraphAction(projectId),
      getCyclesForProjectAction(projectId)
    ])

    if (graphResult.status === "success") {
      setDefinitions(graphResult.data.nodes)
      setDepEdges(graphResult.data.edges)
    }

    if (cyclesResult.status === "success" && cyclesResult.data.length > 0) {
      const sorted = [...cyclesResult.data].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      const latestCycle = sorted[0]
      setLatestCycleId(latestCycle.id)

      const runsResult = await getRunsForCycleAction(latestCycle.id)
      if (runsResult.status === "success") {
        const runMap: Record<string, ReconciliationRun> = {}
        for (const run of runsResult.data) {
          runMap[run.definitionId] = run
        }
        setLatestRuns(runMap)
      }
    }

    setLoading(false)
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Convert definitions and edges to React Flow format
  useEffect(() => {
    if (definitions.length === 0) return

    const COLS = 3
    const X_GAP = 300
    const Y_GAP = 200
    const X_START = 50
    const Y_START = 50

    const flowNodes: Node[] = definitions.map((def, index) => {
      const run = latestRuns[def.id]
      const summary = run?.summary as Record<string, number> | null
      let status: DependencyNodeData["status"] = "none"
      if (run?.status === "completed" && summary) {
        status =
          (summary.breaks ?? 0) > 0 ? "break" : "match"
      }

      return {
        id: def.id,
        type: "dependency",
        position: {
          x: X_START + (index % COLS) * X_GAP,
          y: Y_START + Math.floor(index / COLS) * Y_GAP
        },
        data: {
          label: def.name,
          description: def.description,
          status,
          fileAName: def.sourceAFileId ? "Source A" : undefined,
          fileBName: def.sourceBFileId ? "Source B" : undefined
        } satisfies DependencyNodeData
      }
    })

    const flowEdges: Edge[] = depEdges.map(edge => ({
      id: edge.id,
      source: edge.parentDefinitionId,
      target: edge.childDefinitionId,
      animated: true,
      style: { stroke: "oklch(0.75 0.12 200)", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "oklch(0.75 0.12 200)"
      }
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [definitions, depEdges, latestRuns, setNodes, setEdges])

  const handleAddDependency = async () => {
    if (!parentDefId || !childDefId) {
      toast.error("Select both parent and child definitions")
      return
    }
    if (parentDefId === childDefId) {
      toast.error("Parent and child must be different definitions")
      return
    }

    setSubmitting(true)
    const validMappings = fieldMappings.filter(
      m => m.parentField.trim() && m.childField.trim()
    )

    const propagationRule = {
      fieldMappings: validMappings,
      toleranceOverride: toleranceOverride
        ? parseFloat(toleranceOverride)
        : undefined
    }

    const result = await addDependencyEdgeAction({
      projectId,
      parentDefinitionId: parentDefId,
      childDefinitionId: childDefId,
      propagationRule:
        validMappings.length > 0 || toleranceOverride
          ? propagationRule
          : undefined
    })

    setSubmitting(false)

    if (result.status === "success") {
      toast.success("Dependency edge added")
      setAddDialogOpen(false)
      resetAddForm()
      loadData()
    } else {
      toast.error(result.message)
    }
  }

  const handleDeleteEdge = async (edgeId: string) => {
    const result = await removeDependencyEdgeAction(edgeId)
    if (result.status === "success") {
      toast.success("Dependency edge removed")
      setEdgeDetailOpen(false)
      setSelectedEdge(null)
      loadData()
    } else {
      toast.error(result.message)
    }
  }

  const handlePropagateAll = async () => {
    if (!latestCycleId) {
      toast.error("No cycle available for propagation")
      return
    }
    setPropagating(true)
    const result = await propagateDependenciesAction(latestCycleId)
    setPropagating(false)

    if (result.status === "success") {
      toast.success(
        `Propagated ${result.data.propagatedCount} explanation(s)`
      )
    } else {
      toast.error(result.message)
    }
  }

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const depEdge = depEdges.find(e => e.id === edge.id)
      if (depEdge) {
        setSelectedEdge(depEdge)
        setEdgeDetailOpen(true)
      }
    },
    [depEdges]
  )

  const resetAddForm = () => {
    setParentDefId("")
    setChildDefId("")
    setFieldMappings([{ parentField: "", childField: "" }])
    setToleranceOverride("")
  }

  const addFieldMapping = () => {
    setFieldMappings(prev => [...prev, { parentField: "", childField: "" }])
  }

  const removeFieldMapping = (index: number) => {
    setFieldMappings(prev => prev.filter((_, i) => i !== index))
  }

  const updateFieldMapping = (
    index: number,
    field: "parentField" | "childField",
    value: string
  ) => {
    setFieldMappings(prev =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    )
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <h3 className="text-lg font-semibold">Dependencies</h3>
        <div className="glass-card rounded-xl flex items-center justify-center h-[500px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (definitions.length === 0) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <h3 className="text-lg font-semibold">Dependencies</h3>
        <div className="glass-card rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <GitBranch className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No Definitions Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Create reconciliation definitions first, then define dependencies
            between them to propagate explanation keys across related runs.
          </p>
        </div>
      </div>
    )
  }

  const selectedEdgeRule = selectedEdge?.propagationRule as {
    fieldMappings?: FieldMapping[]
    toleranceOverride?: number
  } | null

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Dependency Graph</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePropagateAll}
            disabled={propagating || !latestCycleId}
          >
            {propagating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Zap className="h-4 w-4 mr-1.5" />
            )}
            Propagate All
          </Button>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Dependency
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md glass-card">
              <DialogHeader>
                <DialogTitle>Add Dependency Edge</DialogTitle>
                <DialogDescription>
                  Define a dependency between two reconciliation definitions for
                  explanation key propagation.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Parent Definition</Label>
                  <Select
                    value={parentDefId}
                    onValueChange={(v) => v && setParentDefId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select parent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {definitions.map(def => (
                        <SelectItem key={def.id} value={def.id}>
                          {def.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Child Definition</Label>
                  <Select
                    value={childDefId}
                    onValueChange={(v) => v && setChildDefId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select child..." />
                    </SelectTrigger>
                    <SelectContent>
                      {definitions.map(def => (
                        <SelectItem key={def.id} value={def.id}>
                          {def.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Field Mappings</Label>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={addFieldMapping}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {fieldMappings.map((mapping, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2"
                      >
                        <Input
                          placeholder="Parent field"
                          value={mapping.parentField}
                          onChange={e =>
                            updateFieldMapping(
                              index,
                              "parentField",
                              e.target.value
                            )
                          }
                          className="flex-1"
                        />
                        <span className="text-muted-foreground text-xs">
                          &rarr;
                        </span>
                        <Input
                          placeholder="Child field"
                          value={mapping.childField}
                          onChange={e =>
                            updateFieldMapping(
                              index,
                              "childField",
                              e.target.value
                            )
                          }
                          className="flex-1"
                        />
                        {fieldMappings.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeFieldMapping(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tolerance Override (optional)</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 0.01"
                    value={toleranceOverride}
                    onChange={e => setToleranceOverride(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddDialogOpen(false)
                    resetAddForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddDependency}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  )}
                  Add Edge
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div
        className="glass-card rounded-xl overflow-hidden"
        style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: "oklch(0.12 0.02 250)" }}
        >
          <Background
            color="oklch(0.25 0.02 250 / 0.3)"
            gap={20}
            size={1}
          />
          <Controls
            style={{
              background: "oklch(0.18 0.02 250 / 0.8)",
              border: "1px solid oklch(0.3 0.02 250 / 0.3)",
              borderRadius: "8px"
            }}
          />
          <MiniMap
            style={{
              background: "oklch(0.14 0.02 250 / 0.8)",
              border: "1px solid oklch(0.3 0.02 250 / 0.3)",
              borderRadius: "8px"
            }}
            nodeColor="oklch(0.35 0.03 220 / 0.8)"
            maskColor="oklch(0.12 0.02 250 / 0.7)"
          />
          <Panel
            position="top-left"
            className="glass-subtle rounded-lg px-3 py-2 text-xs text-muted-foreground"
          >
            {definitions.length} definition(s) &middot; {depEdges.length}{" "}
            edge(s)
          </Panel>
        </ReactFlow>
      </div>

      {/* Edge detail dialog */}
      <Dialog open={edgeDetailOpen} onOpenChange={setEdgeDetailOpen}>
        <DialogContent className="sm:max-w-sm glass-card">
          <DialogHeader>
            <DialogTitle>Edge Details</DialogTitle>
            <DialogDescription>
              {selectedEdge && (
                <>
                  {definitions.find(
                    d => d.id === selectedEdge.parentDefinitionId
                  )?.name ?? "Unknown"}{" "}
                  &rarr;{" "}
                  {definitions.find(
                    d => d.id === selectedEdge.childDefinitionId
                  )?.name ?? "Unknown"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedEdgeRule && (
            <div className="space-y-3 py-2">
              {selectedEdgeRule.fieldMappings &&
                selectedEdgeRule.fieldMappings.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Field Mappings
                    </Label>
                    {selectedEdgeRule.fieldMappings.map(
                      (m: FieldMapping, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="font-mono text-cyan-400">
                            {m.parentField}
                          </span>
                          <span className="text-muted-foreground">
                            &rarr;
                          </span>
                          <span className="font-mono text-cyan-400">
                            {m.childField}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

              {selectedEdgeRule.toleranceOverride !== undefined && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Tolerance Override
                  </Label>
                  <p className="text-sm font-mono">
                    {selectedEdgeRule.toleranceOverride}
                  </p>
                </div>
              )}
            </div>
          )}

          {!selectedEdgeRule && (
            <p className="text-sm text-muted-foreground py-2">
              No propagation rule configured for this edge.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                selectedEdge && handleDeleteEdge(selectedEdge.id)
              }
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Edge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
