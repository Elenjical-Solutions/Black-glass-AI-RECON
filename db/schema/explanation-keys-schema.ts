import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

import { reconciliationProjectsTable } from "./projects-schema"

export const explanationKeysTable = pgTable(
  "explanation_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => reconciliationProjectsTable.id, {
        onDelete: "cascade"
      }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    autoMatchPattern: jsonb("auto_match_pattern"),
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => ({
    uniqueProjectCode: unique("uq_explanation_keys_project_code").on(
      table.projectId,
      table.code
    )
  })
)

export type ExplanationKey = InferSelectModel<typeof explanationKeysTable>
export type InsertExplanationKey = InferInsertModel<
  typeof explanationKeysTable
>
