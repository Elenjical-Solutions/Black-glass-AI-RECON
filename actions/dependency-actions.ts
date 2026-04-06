"use server"

import { db } from "@/db/db"
import {
  dependencyEdgesTable,
  reconciliationDefinitionsTable,
  reconciliationRunsTable,
  reconciliationResultsTable,
  resultFieldDetailsTable
} from "@/db/schema"
import { ActionState } from "@/types/actions-types"
import { DependencyEdge } from "@/db/schema/dependency-edges-schema"
import { ReconciliationDefinition } from "@/db/schema/definitions-schema"
import { eq } from "drizzle-orm"
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
