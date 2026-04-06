import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { jsonb, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"

import { reconciliationDefinitionsTable } from "./definitions-schema"
import { reconciliationProjectsTable } from "./projects-schema"

export const dependencyEdgesTable = pgTable(
  "dependency_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => reconciliationProjectsTable.id, {
        onDelete: "cascade"
      }),
    parentDefinitionId: uuid("parent_definition_id")
      .notNull()
      .references(() => reconciliationDefinitionsTable.id, {
        onDelete: "cascade"
      }),
    childDefinitionId: uuid("child_definition_id")
      .notNull()
      .references(() => reconciliationDefinitionsTable.id, {
        onDelete: "cascade"
      }),
    propagationRule: jsonb("propagation_rule"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => ({
    uniqueParentChild: unique("uq_dependency_edges_parent_child").on(
      table.parentDefinitionId,
      table.childDefinitionId
    )
  })
)

export type DependencyEdge = InferSelectModel<typeof dependencyEdgesTable>
export type InsertDependencyEdge = InferInsertModel<
  typeof dependencyEdgesTable
>
