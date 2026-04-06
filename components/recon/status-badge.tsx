"use client"

import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  GitBranch,
  Clock,
  Play,
  Loader2,
  FileQuestion
} from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status:
    | "match"
    | "break"
    | "missing_a"
    | "missing_b"
    | "explained"
    | "propagated"
    | "draft"
    | "running"
    | "completed"
    | "failed"
    | "pending"
}

const statusConfig: Record<
  StatusBadgeProps["status"],
  {
    label: string
    className: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  match: {
    label: "Match",
    className:
      "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/20",
    icon: CheckCircle2
  },
  break: {
    label: "Break",
    className:
      "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/20",
    icon: XCircle
  },
  missing_a: {
    label: "Missing A",
    className:
      "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20",
    icon: FileQuestion
  },
  missing_b: {
    label: "Missing B",
    className:
      "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20",
    icon: FileQuestion
  },
  explained: {
    label: "Explained",
    className:
      "bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20",
    icon: HelpCircle
  },
  propagated: {
    label: "Propagated",
    className:
      "bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20",
    icon: GitBranch
  },
  draft: {
    label: "Draft",
    className:
      "bg-muted/50 text-muted-foreground border border-border hover:bg-muted/70",
    icon: Clock
  },
  running: {
    label: "Running",
    className:
      "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20",
    icon: Loader2
  },
  completed: {
    label: "Completed",
    className:
      "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/20",
    icon: CheckCircle2
  },
  failed: {
    label: "Failed",
    className:
      "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/20",
    icon: XCircle
  },
  pending: {
    label: "Pending",
    className:
      "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20",
    icon: AlertTriangle
  }
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          status === "running" && "animate-spin"
        )}
      />
      {config.label}
    </Badge>
  )
}
