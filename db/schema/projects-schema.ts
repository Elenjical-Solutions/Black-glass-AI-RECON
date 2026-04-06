import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const reconciliationProjectsTable = pgTable("reconciliation_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type ReconciliationProject = InferSelectModel<
  typeof reconciliationProjectsTable
>
export type InsertReconciliationProject = InferInsertModel<
  typeof reconciliationProjectsTable
>
