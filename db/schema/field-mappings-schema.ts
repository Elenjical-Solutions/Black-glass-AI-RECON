import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

import { reconciliationDefinitionsTable } from "./definitions-schema"

export const fieldMappingsTable = pgTable("field_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  definitionId: uuid("definition_id")
    .notNull()
    .references(() => reconciliationDefinitionsTable.id, {
      onDelete: "cascade"
    }),
  fieldNameA: text("field_name_a").notNull(),
  fieldNameB: text("field_name_b").notNull(),
  matcherType: text("matcher_type").notNull().default("text"),
  tolerance: numeric("tolerance"),
  toleranceType: text("tolerance_type"),
  isKey: boolean("is_key").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type FieldMapping = InferSelectModel<typeof fieldMappingsTable>
export type InsertFieldMapping = InferInsertModel<typeof fieldMappingsTable>
