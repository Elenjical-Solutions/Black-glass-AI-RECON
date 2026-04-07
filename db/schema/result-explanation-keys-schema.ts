import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core"

import { reconciliationResultsTable } from "./results-schema"
import { explanationKeysTable } from "./explanation-keys-schema"

/**
 * Junction table: many-to-many between results and explanation keys.
 * A single break can have MULTIPLE explanation keys (e.g., an IRS trade
 * might have both BOOTSTRAP_METHOD and DAYCOUNT_CONV).
 *
 * Each assignment includes:
 * - assignedBy: "manual" | "auto_match" | "ai_pattern" | "ai_nlr" | "propagated"
 * - confidence: AI confidence % (null for manual/auto)
 * - reasoning: AI's rationale for this assignment
 */
export const resultExplanationKeysTable = pgTable("result_explanation_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  resultId: uuid("result_id")
    .notNull()
    .references(() => reconciliationResultsTable.id, { onDelete: "cascade" }),
  explanationKeyId: uuid("explanation_key_id")
    .notNull()
    .references(() => explanationKeysTable.id, { onDelete: "cascade" }),
  assignedBy: text("assigned_by").notNull().default("manual"), // manual | auto_match | ai_pattern | ai_nlr | propagated
  confidence: integer("confidence"), // 0-100, null for manual
  reasoning: text("reasoning"), // AI's per-assignment rationale
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type ResultExplanationKey = InferSelectModel<typeof resultExplanationKeysTable>
export type InsertResultExplanationKey = InferInsertModel<typeof resultExplanationKeysTable>
