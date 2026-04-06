import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { reconciliationProjectsTable } from "./projects-schema"

export const screenshotsTable = pgTable("screenshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => reconciliationProjectsTable.id, { onDelete: "cascade" }),
  imageData: text("image_data").notNull(),
  label: text("label").notNull(),
  systemSide: text("system_side").notNull(),
  analysisResult: jsonb("analysis_result"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type Screenshot = InferSelectModel<typeof screenshotsTable>
export type InsertScreenshot = InferInsertModel<typeof screenshotsTable>
