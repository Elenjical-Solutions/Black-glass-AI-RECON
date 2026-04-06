import { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

export const aiAnalysisCacheTable = pgTable("ai_analysis_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  cacheKey: text("cache_key").notNull().unique(),
  analysisType: text("analysis_type").notNull(),
  prompt: text("prompt"),
  response: jsonb("response").notNull(),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type AiAnalysisCache = InferSelectModel<typeof aiAnalysisCacheTable>
export type InsertAiAnalysisCache = InferInsertModel<
  typeof aiAnalysisCacheTable
>
