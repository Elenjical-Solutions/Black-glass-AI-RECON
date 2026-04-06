export interface DependencyEdge {
  parentDefinitionId: string
  childDefinitionId: string
  propagationRule: {
    fieldMappings: Array<{ parentField: string; childField: string }>
    toleranceOverride?: number
  }
}

export interface PropagatedResult {
  childResultIndex: number
  parentRunId: string
  parentResultKeyValue: string
  explanationKeyId: string
  explanationKeyCode: string
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns definition IDs in dependency order (parents before children).
 */
export function topologicalSort(
  definitionIds: string[],
  edges: DependencyEdge[]
): string[] {
  // Build adjacency list and in-degree count
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const id of definitionIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }

  for (const edge of edges) {
    const parent = edge.parentDefinitionId
    const child = edge.childDefinitionId

    if (adjacency.has(parent) && inDegree.has(child)) {
      adjacency.get(parent)!.push(child)
      inDegree.set(child, (inDegree.get(child) ?? 0) + 1)
    }
  }

  // Initialize queue with nodes that have no incoming edges
  const queue: string[] = []
  inDegree.forEach((degree, id) => {
    if (degree === 0) {
      queue.push(id)
    }
  })

  const sorted: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (sorted.length !== definitionIds.length) {
    throw new Error("Cycle detected in dependency graph")
  }

  return sorted
}

/**
 * Propagate explanations from parent to child runs.
 * If a parent break is explained and the child has a matching key and similar field diffs,
 * the explanation is propagated to the child.
 */
export function propagateExplanations(
  parentResults: Array<{
    keyValue: string
    status: string
    explanationKeyId: string | null
    explanationKeyCode: string | null
    fields: Array<{ fieldNameA: string; numericDiff?: number }>
  }>,
  childResults: Array<{
    index: number
    keyValue: string
    status: string
    fields: Array<{ fieldNameA: string; numericDiff?: number }>
  }>,
  edge: DependencyEdge
): PropagatedResult[] {
  const propagated: PropagatedResult[] = []

  // Build map of parent results by keyValue
  const parentMap = new Map<
    string,
    (typeof parentResults)[number]
  >()
  for (const parent of parentResults) {
    parentMap.set(parent.keyValue, parent)
  }

  for (const child of childResults) {
    // Only propagate to break results
    if (child.status !== "break") continue

    const parent = parentMap.get(child.keyValue)
    if (!parent) continue

    // Parent must be explained
    if (!parent.explanationKeyId || !parent.explanationKeyCode) continue

    // Check if field mappings show similar diffs
    const fieldMappings = edge.propagationRule.fieldMappings
    const tolerance = edge.propagationRule.toleranceOverride ?? 0

    let allFieldsMatch = true

    for (const mapping of fieldMappings) {
      const parentField = parent.fields.find((f) => f.fieldNameA === mapping.parentField)
      const childField = child.fields.find((f) => f.fieldNameA === mapping.childField)

      if (!parentField || !childField) {
        allFieldsMatch = false
        break
      }

      // Compare numeric diffs if available
      if (parentField.numericDiff !== undefined && childField.numericDiff !== undefined) {
        const diffOfDiffs = Math.abs(parentField.numericDiff - childField.numericDiff)
        if (diffOfDiffs > tolerance) {
          allFieldsMatch = false
          break
        }
      }
    }

    if (allFieldsMatch) {
      propagated.push({
        childResultIndex: child.index,
        parentRunId: edge.parentDefinitionId,
        parentResultKeyValue: parent.keyValue,
        explanationKeyId: parent.explanationKeyId,
        explanationKeyCode: parent.explanationKeyCode,
      })
    }
  }

  return propagated
}
