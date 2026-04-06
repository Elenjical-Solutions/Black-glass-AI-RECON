import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { reconciliationProjectsTable } from "./projects-schema"
import { uploadedFilesTable } from "./uploaded-files-schema"

export const reconciliationDefinitionsTable = pgTable(
  "reconciliation_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => reconciliationProjectsTable.id, {
        onDelete: "cascade"
      }),
    name: text("name").notNull(),
    description: text("description"),
    sourceAFileId: uuid("source_a_file_id").references(
      () => uploadedFilesTable.id,
      { onDelete: "cascade" }
    ),
    sourceBFileId: uuid("source_b_file_id").references(
      () => uploadedFilesTable.id,
      { onDelete: "cascade" }
    ),
    keyFields: jsonb("key_fields").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  }
)

export type ReconciliationDefinition = InferSelectModel<
  typeof reconciliationDefinitionsTable
>
export type InsertReconciliationDefinition = InferInsertModel<
  typeof reconciliationDefinitionsTable
>
