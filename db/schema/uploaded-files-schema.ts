import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

import { reconciliationProjectsTable } from "./projects-schema"

export const uploadedFilesTable = pgTable("uploaded_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => reconciliationProjectsTable.id, { onDelete: "cascade" }),
  uploaderId: text("uploader_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  fileRole: text("file_role").notNull(),
  fileContent: text("file_content"),
  parsedHeaders: jsonb("parsed_headers"),
  rowCount: integer("row_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type UploadedFile = InferSelectModel<typeof uploadedFilesTable>
export type InsertUploadedFile = InferInsertModel<typeof uploadedFilesTable>
