import { db } from "@/db/db"
import { aiAnalysisCacheTable } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { createHash } from "crypto"

export function generateCacheKey(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export async function getCachedResult(
  cacheKey: string
): Promise<unknown | null> {
  try {
    const [cached] = await db
      .select()
      .from(aiAnalysisCacheTable)
      .where(
        and(
          eq(aiAnalysisCacheTable.cacheKey, cacheKey),
          gt(aiAnalysisCacheTable.expiresAt, new Date())
        )
      )

    if (!cached) return null
    return cached.response
  } catch {
    return null
  }
}

export async function setCacheResult(
  cacheKey: string,
  analysisType: string,
  prompt: string,
  response: unknown,
  modelUsed: string,
  tokensUsed?: number,
  ttlHours: number = 24
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

    await db
      .insert(aiAnalysisCacheTable)
      .values({
        cacheKey,
        analysisType,
        prompt,
        response,
        modelUsed,
        tokensUsed: tokensUsed ?? null,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: aiAnalysisCacheTable.cacheKey,
        set: {
          response,
          modelUsed,
          tokensUsed: tokensUsed ?? null,
          expiresAt,
        },
      })
  } catch (error) {
    console.error("Failed to set AI cache:", error)
  }
}
