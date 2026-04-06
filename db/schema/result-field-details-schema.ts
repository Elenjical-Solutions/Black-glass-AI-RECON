import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid
} from "drizzle-orm/pg-core"

import { fieldMappingsTable } from "./field-mappings-schema"
import { reconciliationResultsTable } from "./results-schema"

export const resultFieldDetailsTable = pgTable("result_field_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  resultId: uuid("result_id")
    .notNull()
    .references(() => reconciliationResultsTable.id, { onDelete: "cascade" }),
  fieldMappingId: uuid("field_mapping_id")
    .notNull()
    .references(() => fieldMappingsTable.id, { onDelete: "cascade" }),
  valueA: text("value_a"),
  valueB: text("value_b"),
  numericDiff: numeric("numeric_diff"),
  isMatch: boolean("is_match").notNull(),
  matcherOutput: jsonb("matcher_output")
})

export type ResultFieldDetail = InferSelectModel<
  typeof resultFieldDetailsTable
>
export type InsertResultFieldDetail = InferInsertModel<
  typeof resultFieldDetailsTable
>
