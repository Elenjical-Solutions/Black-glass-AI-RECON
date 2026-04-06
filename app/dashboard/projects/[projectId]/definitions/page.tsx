"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { getDefinitionsForProjectAction } from "@/actions/definitions-actions"
import { getFilesForProjectAction } from "@/actions/files-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, GitCompareArrows, FileSpreadsheet, ArrowRight } from "lucide-react"
import type { ReconciliationDefinition } from "@/db/schema/definitions-schema"
import type { UploadedFile } from "@/db/schema/uploaded-files-schema"

export default function DefinitionsPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const [definitions, setDefinitions] = useState<ReconciliationDefinition[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [defsResult, filesResult] = await Promise.all([
      getDefinitionsForProjectAction(projectId),
      getFilesForProjectAction(projectId)
    ])
    if (defsResult.status === "success") setDefinitions(defsResult.data)
    if (filesResult.status === "success") setFiles(filesResult.data)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const fileNameMap = new Map(files.map(f => [f.id, f.filename]))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reconciliation Definitions</h3>
        <Link href={`/dashboard/projects/${projectId}/definitions/new`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Definition
          </Button>
        </Link>
      </div>

      {/* Definitions List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : definitions.length === 0 ? (
        <Card className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <GitCompareArrows className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No definitions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Create a definition to map fields between two data sources for
            reconciliation.
          </p>
          <Link
            href={`/dashboard/projects/${projectId}/definitions/new`}
            className="mt-4"
          >
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Definition
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {definitions.map(def => (
            <Link
              key={def.id}
              href={`/dashboard/projects/${projectId}/definitions/${def.id}`}
            >
              <Card className="glass-card p-5 transition-all duration-200 hover:border-primary/30 hover:glow-blue cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">
                        {def.name}
                      </h4>
                      {Array.isArray(def.keyFields) && def.keyFields.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {(def.keyFields as any[]).length} key field
                          {(def.keyFields as any[]).length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    {def.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                        {def.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      {def.sourceAFileId && (
                        <span className="flex items-center gap-1">
                          <FileSpreadsheet className="h-3 w-3" />
                          A: {fileNameMap.get(def.sourceAFileId) ?? "Unknown"}
                        </span>
                      )}
                      {def.sourceBFileId && (
                        <span className="flex items-center gap-1">
                          <FileSpreadsheet className="h-3 w-3" />
                          B: {fileNameMap.get(def.sourceBFileId) ?? "Unknown"}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
