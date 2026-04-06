"use server"

import { db } from "@/db/db"
import {
  dependencyEdgesTable,
  reconciliationDefinitionsTable,
  reconciliationRunsTable,
  reconciliationResultsTable,
  resultFieldDetailsTable,
  explanationKeysTable
} from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { DependencyEdge } from "@/db/schema/dependency-edges-schema"
import { ReconciliationDefinition } from "@/db/schema/definitions-schema"
import { eq, and, inArray, sql } from "drizzle-orm"
import {
  topologicalSort,
  propagateExplanations,
  DependencyEdge as DepEdgeConfig
} from "@/lib/recon/dependency-propagator"

export async function addDependencyEdgeAction(data: {
  projectId: string
  parentDefinitionId: string
  childDefinitionId: string
  propagationRule?: any
}): Promise<ActionState<DependencyEdge>> {
  try {
    const [edge] = await db
      .insert(dependencyEdgesTable)
      .values({
        projectId: data.projectId,
        parentDefinitionId: data.parentDefinitionId,
        childDefinitionId: data.childDefinitionId,
        propagationRule: data.propagationRule ?? null
      })
      .returning()

    return { status: "success", data: edge }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function removeDependencyEdgeAction(
  edgeId: string
): Promise<ActionState<void>> {
  try {
    await db
      .delete(dependencyEdgesTable)
      .where(eq(dependencyEdgesTable.id, edgeId))

    return { status: "success", data: undefined }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getDependencyGraphAction(
  projectId: string
): Promise<
  ActionState<{
    nodes: ReconciliationDefinition[]
    edges: DependencyEdge[]
  }>
> {
  try {
    const nodes = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.projectId, projectId))

    const edges = await db
      .select()
      .from(dependencyEdgesTable)
      .where(eq(dependencyEdgesTable.projectId, projectId))

    return { status: "success", data: { nodes, edges } }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function propagateDependenciesAction(
  cycleId: string
): Promise<ActionState<{ propagatedCount: number }>> {
  try {
    // Load all runs in this cycle
    const runs = await db
      .select()
      .from(reconciliationRunsTable)
      .where(eq(reconciliationRunsTable.cycleId, cycleId))

    if (runs.length === 0) {
      return { status: "success", data: { propagatedCount: 0 } }
    }

    // Get the projectId from the first run's definition
    const [firstDef] = await db
      .select()
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.id, runs[0].definitionId))

    if (!firstDef) {
      return { status: "error", message: "Definition not found for run" }
    }

    const projectId = firstDef.projectId

    // Load dependency graph
    const edges = await db
      .select()
      .from(dependencyEdgesTable)
      .where(eq(dependencyEdgesTable.projectId, projectId))

    if (edges.length === 0) {
      return { status: "success", data: { propagatedCount: 0 } }
    }

    // Build a map of definitionId -> run
    const runByDefinition = new Map<string, typeof runs[0]>()
    for (const run of runs) {
      runByDefinition.set(run.definitionId, run)
    }

    // Get all definition IDs involved
    const definitionIds = [...new Set(runs.map(r => r.definitionId))]

    // Convert edges for topological sort
    const depEdges: DepEdgeConfig[] = edges.map(e => ({
      parentDefinitionId: e.parentDefinitionId,
      childDefinitionId: e.childDefinitionId,
      propagationRule: (e.propagationRule as any) ?? {
        fieldMappings: [],
        toleranceOverride: 0
      }
    }))

    // Topological sort
    const sorted = topologicalSort(definitionIds, depEdges)

    let propagatedCount = 0

    // For each edge, propagate explanations
    for (const edge of depEdges) {
      const parentRun = runByDefinition.get(edge.parentDefinitionId)
      const childRun = runByDefinition.get(edge.childDefinitionId)

      if (!parentRun || !childRun) continue

      // Load parent results with field details
      const parentResults = await db
        .select()
        .from(reconciliationResultsTable)
        .where(eq(reconciliationResultsTable.runId, parentRun.id))

      const parentResultsWithFields = await Promise.all(
        parentResults.map(async (r) => {
          const details = await db
            .select()
            .from(resultFieldDetailsTable)
            .where(eq(resultFieldDetailsTable.resultId, r.id))

          return {
            keyValue: r.rowKeyValue,
            status: r.status,
            explanationKeyId: r.explanationKeyId,
            explanationKeyCode: null as string | null,
            fields: details.map(d => ({
              fieldNameA: d.fieldMappingId,
              numericDiff: d.numericDiff ? parseFloat(d.numericDiff) : undefined
            }))
          }
        })
      )

      // Load child results with field details
      const childResults = await db
        .select()
        .from(reconciliationResultsTable)
        .where(eq(reconciliationResultsTable.runId, childRun.id))

      const childResultsWithFields = await Promise.all(
        childResults.map(async (r, index) => {
          const details = await db
            .select()
            .from(resultFieldDetailsTable)
            .where(eq(resultFieldDetailsTable.resultId, r.id))

          return {
            index,
            keyValue: r.rowKeyValue,
            status: r.status,
            fields: details.map(d => ({
              fieldNameA: d.fieldMappingId,
              numericDiff: d.numericDiff ? parseFloat(d.numericDiff) : undefined
            }))
          }
        })
      )

      // Run propagation
      const propagated = propagateExplanations(
        parentResultsWithFields,
        childResultsWithFields,
        edge
      )

      // Update child results with propagated explanation keys
      for (const prop of propagated) {
        const childResult = childResults[prop.childResultIndex]
        if (!childResult) continue

        await db
          .update(reconciliationResultsTable)
          .set({
            explanationKeyId: prop.explanationKeyId,
            isPropagated: true,
            propagatedFromRunId: parentRun.id
          })
          .where(eq(reconciliationResultsTable.id, childResult.id))

        propagatedCount++
      }
    }

    return { status: "success", data: { propagatedCount } }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getDependencyGraphWithStatsAction(
  projectId: string,
  cycleId?: string
): Promise<
  ActionState<{
    nodes: Array<{
      id: string
      name: string
      description: string | null
      category: string | null
      department: string | null
      sourceAFileId: string | null
      sourceBFileId: string | null
      runId: string | null
      runStatus: string | null
      runSummary: any | null
    }>
    edges: Array<{
      id: string
      parentDefinitionId: string
      childDefinitionId: string
      propagationRule: any
    }>
  }>
> {
  try {
    const definitions = await db
      .select({
        id: reconciliationDefinitionsTable.id,
        name: reconciliationDefinitionsTable.name,
        description: reconciliationDefinitionsTable.description,
        category: reconciliationDefinitionsTable.category,
        department: reconciliationDefinitionsTable.department,
        sourceAFileId: reconciliationDefinitionsTable.sourceAFileId,
        sourceBFileId: reconciliationDefinitionsTable.sourceBFileId
      })
      .from(reconciliationDefinitionsTable)
      .where(eq(reconciliationDefinitionsTable.projectId, projectId))

    const runMap = new Map<
      string,
      { runId: string; runStatus: string; runSummary: any }
    >()

    if (cycleId) {
      const runs = await db
        .select({
          id: reconciliationRunsTable.id,
          definitionId: reconciliationRunsTable.definitionId,
          status: reconciliationRunsTable.status,
          summary: reconciliationRunsTable.summary
        })
        .from(reconciliationRunsTable)
        .where(eq(reconciliationRunsTable.cycleId, cycleId))

      for (const run of runs) {
        runMap.set(run.definitionId, {
          runId: run.id,
          runStatus: run.status,
          runSummary: run.summary
        })
      }
    }

    const nodes = definitions.map(def => {
      const runInfo = runMap.get(def.id)
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        department: def.department,
        sourceAFileId: def.sourceAFileId,
        sourceBFileId: def.sourceBFileId,
        runId: runInfo?.runId ?? null,
        runStatus: runInfo?.runStatus ?? null,
        runSummary: runInfo?.runSummary ?? null
      }
    })

    const edges = await db
      .select({
        id: dependencyEdgesTable.id,
        parentDefinitionId: dependencyEdgesTable.parentDefinitionId,
        childDefinitionId: dependencyEdgesTable.childDefinitionId,
        propagationRule: dependencyEdgesTable.propagationRule
      })
      .from(dependencyEdgesTable)
      .where(eq(dependencyEdgesTable.projectId, projectId))

    return { status: "success", data: { nodes, edges } }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getLineageForDefinitionAction(
  definitionId: string,
  projectId: string
): Promise<
  ActionState<{
    nodes: ReconciliationDefinition[]
    edges: DependencyEdge[]
    selectedId: string
  }>
> {
  try {
    const allEdges = await db
      .select()
      .from(dependencyEdgesTable)
      .where(eq(dependencyEdgesTable.projectId, projectId))

    // Build adjacency maps
    const parentToChildren = new Map<string, string[]>()
    const childToParents = new Map<string, string[]>()

    for (const edge of allEdges) {
      if (!parentToChildren.has(edge.parentDefinitionId)) {
        parentToChildren.set(edge.parentDefinitionId, [])
      }
      parentToChildren.get(edge.parentDefinitionId)!.push(edge.childDefinitionId)

      if (!childToParents.has(edge.childDefinitionId)) {
        childToParents.set(edge.childDefinitionId, [])
      }
      childToParents.get(edge.childDefinitionId)!.push(edge.parentDefinitionId)
    }

    const relatedIds = new Set<string>()
    relatedIds.add(definitionId)

    // BFS upward (ancestors)
    const upQueue = [definitionId]
    while (upQueue.length > 0) {
      const current = upQueue.shift()!
      const parents = childToParents.get(current) ?? []
      for (const parentId of parents) {
        if (!relatedIds.has(parentId)) {
          relatedIds.add(parentId)
          upQueue.push(parentId)
        }
      }
    }

    // BFS downward (descendants)
    const downQueue = [definitionId]
    while (downQueue.length > 0) {
      const current = downQueue.shift()!
      const children = parentToChildren.get(current) ?? []
      for (const childId of children) {
        if (!relatedIds.has(childId)) {
          relatedIds.add(childId)
          downQueue.push(childId)
        }
      }
    }

    const relatedIdsArray = Array.from(relatedIds)

    let nodes: ReconciliationDefinition[] = []
    if (relatedIdsArray.length > 0) {
      nodes = await db
        .select()
        .from(reconciliationDefinitionsTable)
        .where(inArray(reconciliationDefinitionsTable.id, relatedIdsArray))
    }

    const filteredEdges = allEdges.filter(
      edge =>
        relatedIds.has(edge.parentDefinitionId) &&
        relatedIds.has(edge.childDefinitionId)
    )

    return {
      status: "success",
      data: { nodes, edges: filteredEdges, selectedId: definitionId }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}

export async function getExplanationFlowAction(
  runId: string
): Promise<
  ActionState<{
    results: Array<{
      rowKeyValue: string
      explanationKeyCode: string | null
      explanationKeyLabel: string | null
      explanationKeyColor: string | null
      parentDefinitionName: string | null
    }>
    summary: Array<{
      explanationKeyCode: string | null
      explanationKeyLabel: string | null
      explanationKeyColor: string | null
      count: number
    }>
    upstreamSources: Array<{
      definitionName: string
      definitionId: string
      propagatedCount: number
    }>
  }>
> {
  try {
    // Get results that are propagated OR have an explanation key assigned
    const propagatedResults = await db
      .select({
        rowKeyValue: reconciliationResultsTable.rowKeyValue,
        status: reconciliationResultsTable.status,
        explanationKeyId: reconciliationResultsTable.explanationKeyId,
        isPropagated: reconciliationResultsTable.isPropagated,
        propagatedFromRunId: reconciliationResultsTable.propagatedFromRunId
      })
      .from(reconciliationResultsTable)
      .where(
        and(
          eq(reconciliationResultsTable.runId, runId),
          sql`(${reconciliationResultsTable.isPropagated} = true OR ${reconciliationResultsTable.explanationKeyId} IS NOT NULL)`
        )
      )

    // Collect unique explanation key IDs
    const explanationKeyIds = [
      ...new Set(
        propagatedResults
          .map(r => r.explanationKeyId)
          .filter((id): id is string => id !== null)
      )
    ]

    // Fetch explanation keys
    const keyMap = new Map<
      string,
      { code: string; label: string; color: string | null }
    >()
    if (explanationKeyIds.length > 0) {
      const keys = await db
        .select({
          id: explanationKeysTable.id,
          code: explanationKeysTable.code,
          label: explanationKeysTable.label,
          color: explanationKeysTable.color
        })
        .from(explanationKeysTable)
        .where(inArray(explanationKeysTable.id, explanationKeyIds))

      for (const key of keys) {
        keyMap.set(key.id, {
          code: key.code,
          label: key.label,
          color: key.color
        })
      }
    }

    // Collect unique propagatedFromRunIds and resolve parent definitions
    const parentRunIds = [
      ...new Set(
        propagatedResults
          .map(r => r.propagatedFromRunId)
          .filter((id): id is string => id !== null)
      )
    ]

    const parentDefMap = new Map<
      string,
      { definitionName: string; definitionId: string }
    >()
    if (parentRunIds.length > 0) {
      const parentRuns = await db
        .select({
          runId: reconciliationRunsTable.id,
          definitionId: reconciliationRunsTable.definitionId,
          definitionName: reconciliationDefinitionsTable.name
        })
        .from(reconciliationRunsTable)
        .innerJoin(
          reconciliationDefinitionsTable,
          eq(
            reconciliationRunsTable.definitionId,
            reconciliationDefinitionsTable.id
          )
        )
        .where(inArray(reconciliationRunsTable.id, parentRunIds))

      for (const pr of parentRuns) {
        parentDefMap.set(pr.runId, {
          definitionName: pr.definitionName,
          definitionId: pr.definitionId
        })
      }
    }

    // Build results
    const results = propagatedResults.map(r => {
      const keyInfo = r.explanationKeyId
        ? keyMap.get(r.explanationKeyId)
        : null
      const parentInfo = r.propagatedFromRunId
        ? parentDefMap.get(r.propagatedFromRunId)
        : null

      return {
        rowKeyValue: r.rowKeyValue,
        explanationKeyCode: keyInfo?.code ?? null,
        explanationKeyLabel: keyInfo?.label ?? null,
        explanationKeyColor: keyInfo?.color ?? null,
        parentDefinitionName: parentInfo?.definitionName ?? null
      }
    })

    // Build summary: aggregate counts by explanation key
    const summaryMap = new Map<
      string,
      {
        explanationKeyCode: string | null
        explanationKeyLabel: string | null
        explanationKeyColor: string | null
        count: number
      }
    >()
    for (const r of results) {
      const mapKey = r.explanationKeyCode ?? "__none__"
      if (!summaryMap.has(mapKey)) {
        summaryMap.set(mapKey, {
          explanationKeyCode: r.explanationKeyCode,
          explanationKeyLabel: r.explanationKeyLabel,
          explanationKeyColor: r.explanationKeyColor,
          count: 0
        })
      }
      summaryMap.get(mapKey)!.count++
    }
    const summary = Array.from(summaryMap.values())

    // Build upstream sources: aggregate counts by parent definition
    const upstreamMap = new Map<
      string,
      { definitionName: string; definitionId: string; propagatedCount: number }
    >()
    for (const r of propagatedResults) {
      if (!r.propagatedFromRunId) continue
      const parentInfo = parentDefMap.get(r.propagatedFromRunId)
      if (!parentInfo) continue

      if (!upstreamMap.has(parentInfo.definitionId)) {
        upstreamMap.set(parentInfo.definitionId, {
          definitionName: parentInfo.definitionName,
          definitionId: parentInfo.definitionId,
          propagatedCount: 0
        })
      }
      upstreamMap.get(parentInfo.definitionId)!.propagatedCount++
    }
    const upstreamSources = Array.from(upstreamMap.values())

    return {
      status: "success",
      data: { results, summary, upstreamSources }
    }
  } catch (error: any) {
    return { status: "error", message: error.message }
  }
}
