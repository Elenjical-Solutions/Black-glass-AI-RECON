import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

import { explanationKeysTable } from "./explanation-keys-schema"
import { reconciliationRunsTable } from "./runs-schema"

export const reconciliationResultsTable = pgTable("reconciliation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => reconciliationRunsTable.id, { onDelete: "cascade" }),
  rowKeyValue: text("row_key_value").notNull(),
  sourceARowIndex: integer("source_a_row_index"),
  sourceBRowIndex: integer("source_b_row_index"),
  status: text("status").notNull(),
  explanationKeyId: uuid("explanation_key_id").references(
    () => explanationKeysTable.id,
    { onDelete: "cascade" }
  ),
  aiExplanation: text("ai_explanation"),
  aiCategory: text("ai_category"),
  isPropagated: boolean("is_propagated").default(false),
  propagatedFromRunId: uuid("propagated_from_run_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type ReconciliationResult = InferSelectModel<
  typeof reconciliationResultsTable
>
export type InsertReconciliationResult = InferInsertModel<
  typeof reconciliationResultsTable
>
