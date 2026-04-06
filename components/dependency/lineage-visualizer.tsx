"use client"

import { useMemo, useCallback, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { EnhancedDependencyNode, type EnhancedNodeData } from "./enhanced-dependency-node"
import type { DefinitionWithStats } from "./tree-browser"

interface LineageEdge {
  id: string
  parentDefinitionId: string
  childDefinitionId: string
  propagationRule: any
}

interface LineageVisualizerProps {
  definitions: DefinitionWithStats[]
  edges: LineageEdge[]
  selectedId: string | null
  onNodeClick: (id: string) => void
}

const nodeTypes = {
  enhanced: EnhancedDependencyNode,
}

function extractSummaryField(def: DefinitionWithStats, field: string): number {
  if (!def.runSummary) return 0
  const summary = typeof def.runSummary === "string" ? JSON.parse(def.runSummary) : def.runSummary
  return summary[field] ?? 0
}

function getNodeStatus(def: DefinitionWithStats): "match" | "break" | "none" {
  if (!def.runId) return "none"
  const breaks = extractSummaryField(def, "breaks") || extractSummaryField(def, "totalBreaks")
  return breaks > 0 ? "break" : "match"
}

export function LineageVisualizer({
  definitions,
  edges: rawEdges,
  selectedId,
  onNodeClick,
}: LineageVisualizerProps) {
  // Build the lineage subgraph around selectedId
  const { lineageNodes, lineageEdges } = useMemo(() => {
    if (!selectedId) return { lineageNodes: [] as Node[], lineageEdges: [] as Edge[] }

    const defMap = new Map(definitions.map((d) => [d.id, d]))

    // Build adjacency lists
    const childrenOf = new Map<string, string[]>()
    const parentsOf = new Map<string, string[]>()
    for (const edge of rawEdges) {
      if (!childrenOf.has(edge.parentDefinitionId)) childrenOf.set(edge.parentDefinitionId, [])
      childrenOf.get(edge.parentDefinitionId)!.push(edge.childDefinitionId)
      if (!parentsOf.has(edge.childDefinitionId)) parentsOf.set(edge.childDefinitionId, [])
      parentsOf.get(edge.childDefinitionId)!.push(edge.parentDefinitionId)
    }

    // Walk ancestors
    const lineageIds = new Set<string>()
    lineageIds.add(selectedId)

    function walkUp(id: string) {
      const parents = parentsOf.get(id) ?? []
      for (const p of parents) {
        if (!lineageIds.has(p)) {
          lineageIds.add(p)
          walkUp(p)
        }
      }
    }

    function walkDown(id: string) {
      const children = childrenOf.get(id) ?? []
      for (const c of children) {
        if (!lineageIds.has(c)) {
          lineageIds.add(c)
          walkDown(c)
        }
      }
    }

    walkUp(selectedId)
    walkDown(selectedId)

    // Filter edges to only those within the subgraph
    const subEdges = rawEdges.filter(
      (e) => lineageIds.has(e.parentDefinitionId) && lineageIds.has(e.childDefinitionId)
    )

    // Compute levels (BFS from roots)
    const roots = Array.from(lineageIds).filter((id) => {
      const parents = parentsOf.get(id) ?? []
      return parents.every((p) => !lineageIds.has(p))
    })

    const levels = new Map<string, number>()
    const queue = roots.map((id) => ({ id, level: 0 }))
    for (const r of roots) levels.set(r, 0)

    while (queue.length > 0) {
      const { id, level } = queue.shift()!
      const children = childrenOf.get(id) ?? []
      for (const child of children) {
        if (lineageIds.has(child)) {
          const existingLevel = levels.get(child)
          const newLevel = level + 1
          if (existingLevel === undefined || newLevel > existingLevel) {
            levels.set(child, newLevel)
            queue.push({ id: child, level: newLevel })
          }
        }
      }
    }

    // Group by level for horizontal spread
    const byLevel = new Map<number, string[]>()
    for (const [id, level] of levels) {
      if (!byLevel.has(level)) byLevel.set(level, [])
      byLevel.get(level)!.push(id)
    }

    const X_GAP = 300
    const Y_GAP = 150

    const nodes: Node[] = []
    for (const [level, ids] of byLevel) {
      const totalWidth = (ids.length - 1) * X_GAP
      const startX = -totalWidth / 2
      ids.forEach((id, i) => {
        const def = defMap.get(id)
        if (!def) return
        nodes.push({
          id,
          type: "enhanced",
          position: { x: startX + i * X_GAP, y: level * Y_GAP },
          data: {
            label: def.name,
            description: def.description,
            category: def.category,
            department: def.department,
            status: getNodeStatus(def),
            matched: extractSummaryField(def, "matched") || extractSummaryField(def, "totalMatched"),
            breaks: extractSummaryField(def, "breaks") || extractSummaryField(def, "totalBreaks"),
            explained: extractSummaryField(def, "explained") || extractSummaryField(def, "totalExplained"),
            isSelected: id === selectedId,
          } satisfies EnhancedNodeData,
        })
      })
    }

    const edges: Edge[] = subEdges.map((e) => ({
      id: e.id,
      source: e.parentDefinitionId,
      target: e.childDefinitionId,
      animated: true,
      style: { stroke: "oklch(0.75 0.12 200)", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "oklch(0.75 0.12 200)",
      },
    }))

    return { lineageNodes: nodes, lineageEdges: edges }
  }, [definitions, rawEdges, selectedId])

  const [nodes, setNodes, onNodesChange] = useNodesState(lineageNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(lineageEdges)

  // Sync when lineage changes
  useEffect(() => {
    setNodes(lineageNodes)
    setEdges(lineageEdges)
  }, [lineageNodes, lineageEdges, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id)
    },
    [onNodeClick]
  )

  if (!selectedId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="text-lg opacity-40">&#x2B21;</div>
          <p>Select a definition from the tree to view its lineage</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="oklch(0.3 0.02 250 / 0.3)" gap={20} />
        <Controls
          showInteractive={false}
          className="[&>button]:bg-background [&>button]:border-border [&>button]:text-foreground"
        />
      </ReactFlow>
    </div>
  )
}
