"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import {
  getCyclesForProjectAction,
  createCycleAction,
  deleteCycleAction
} from "@/actions/cycles-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Plus,
  RefreshCcw,
  ArrowRight,
  Trash2,
  Loader2,
  Calendar
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { RegressionCycle } from "@/db/schema/cycles-schema"

function statusBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "running":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    case "failed":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export default function CyclesPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const [cycles, setCycles] = useState<RegressionCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cycleName, setCycleName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const loadCycles = useCallback(async () => {
    const result = await getCyclesForProjectAction(projectId)
    if (result.status === "success") setCycles(result.data)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    loadCycles()
  }, [loadCycles])

  async function handleCreate() {
    if (!cycleName.trim()) {
      toast.error("Cycle name is required")
      return
    }

    setIsCreating(true)
    try {
      const result = await createCycleAction(projectId, cycleName.trim())
      if (result.status === "success") {
        toast.success("Cycle created")
        setDialogOpen(false)
        setCycleName("")
        loadCycles()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Failed to create cycle")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(cycleId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = await deleteCycleAction(cycleId)
    if (result.status === "success") {
      toast.success("Cycle deleted")
      loadCycles()
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Regression Cycles</h3>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Cycle
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <Card className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <RefreshCcw className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No cycles yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Create a regression cycle to run reconciliation against your
            definitions.
          </p>
          <Button
            className="mt-4 gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Cycle
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <Link
              key={cycle.id}
              href={`/dashboard/projects/${projectId}/cycles/${cycle.id}`}
            >
              <Card className="glass-card p-5 transition-all duration-200 hover:border-primary/30 hover:glow-blue cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">
                        {cycle.name}
                      </h4>
                      <Badge className={cn(statusBadgeVariant(cycle.status))}>
                        {cycle.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      {cycle.startedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Started{" "}
                          {format(
                            new Date(cycle.startedAt),
                            "MMM d, yyyy HH:mm"
                          )}
                        </span>
                      )}
                      {cycle.completedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Completed{" "}
                          {format(
                            new Date(cycle.completedAt),
                            "MMM d, yyyy HH:mm"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={e => handleDelete(cycle.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New Regression Cycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Cycle Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., March 2026 Monthly Recon"
                value={cycleName}
                onChange={e => setCycleName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !cycleName.trim()}
            >
              {isCreating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
