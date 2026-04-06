import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { reconciliationProjectsTable } from "./projects-schema"

export const regressionCyclesTable = pgTable("regression_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => reconciliationProjectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type RegressionCycle = InferSelectModel<typeof regressionCyclesTable>
export type InsertRegressionCycle = InferInsertModel<
  typeof regressionCyclesTable
>
