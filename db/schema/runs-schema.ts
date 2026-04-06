import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { regressionCyclesTable } from "./cycles-schema"
import { reconciliationDefinitionsTable } from "./definitions-schema"

export const reconciliationRunsTable = pgTable("reconciliation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id")
    .notNull()
    .references(() => regressionCyclesTable.id, { onDelete: "cascade" }),
  definitionId: uuid("definition_id")
    .notNull()
    .references(() => reconciliationDefinitionsTable.id, {
      onDelete: "cascade"
    }),
  status: text("status").notNull().default("pending"),
  summary: jsonb("summary"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type ReconciliationRun = InferSelectModel<
  typeof reconciliationRunsTable
>
export type InsertReconciliationRun = InferInsertModel<
  typeof reconciliationRunsTable
>
