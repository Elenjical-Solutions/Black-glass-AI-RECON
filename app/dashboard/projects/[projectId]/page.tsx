import { getProjectByIdAction } from "@/actions/projects-actions"
import { getFilesForProjectAction } from "@/actions/files-actions"
import { getDefinitionsForProjectAction } from "@/actions/definitions-actions"
import { getCyclesForProjectAction } from "@/actions/cycles-actions"
import { getExplanationKeysAction } from "@/actions/explanation-keys-actions"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileUp,
  GitCompareArrows,
  Play,
  Files,
  BookOpen,
  RefreshCcw,
  Key,
  Pencil
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const [projectResult, filesResult, definitionsResult, cyclesResult, keysResult] =
    await Promise.all([
      getProjectByIdAction(projectId),
      getFilesForProjectAction(projectId),
      getDefinitionsForProjectAction(projectId),
      getCyclesForProjectAction(projectId),
      getExplanationKeysAction(projectId)
    ])

  if (projectResult.status === "error") {
    notFound()
  }

  const project = projectResult.data
  const files = filesResult.status === "success" ? filesResult.data : []
  const definitions =
    definitionsResult.status === "success" ? definitionsResult.data : []
  const cycles = cyclesResult.status === "success" ? cyclesResult.data : []
  const keys = keysResult.status === "success" ? keysResult.data : []

  const stats = [
    {
      label: "Files",
      value: files.length,
      icon: Files,
      color: "text-blue-400"
    },
    {
      label: "Definitions",
      value: definitions.length,
      icon: BookOpen,
      color: "text-cyan-400"
    },
    {
      label: "Cycles",
      value: cycles.length,
      icon: RefreshCcw,
      color: "text-green-400"
    },
    {
      label: "Explanation Keys",
      value: keys.length,
      icon: Key,
      color: "text-amber-400"
    }
  ]

  const quickActions = [
    {
      label: "Upload File",
      href: `/dashboard/projects/${projectId}/files`,
      icon: FileUp,
      description: "Add source data files"
    },
    {
      label: "Create Definition",
      href: `/dashboard/projects/${projectId}/definitions/new`,
      icon: GitCompareArrows,
      description: "Map fields between sources"
    },
    {
      label: "Start Cycle",
      href: `/dashboard/projects/${projectId}/cycles`,
      icon: Play,
      description: "Run a reconciliation cycle"
    }
  ]

  const recentCycles = cycles.slice(0, 5)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Project Info Card */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{project.name}</h2>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <Link href={`/dashboard/projects/${projectId}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </Link>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.label} className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2.5">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {quickActions.map(action => (
            <Link key={action.label} href={action.href}>
              <Card className="glass-card p-5 transition-all duration-200 hover:border-primary/30 hover:glow-blue cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-primary transition-colors">
                      {action.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Cycles */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Cycles</h3>
        {recentCycles.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No cycles yet. Create a cycle to start reconciling data.
            </p>
          </Card>
        ) : (
          <Card className="glass-card overflow-hidden">
            <div className="divide-y divide-border/50">
              {recentCycles.map(cycle => (
                <Link
                  key={cycle.id}
                  href={`/dashboard/projects/${projectId}/cycles/${cycle.id}`}
                  className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
                >
                  <div>
                    <p className="font-medium">{cycle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cycle.startedAt
                        ? `Started ${new Date(cycle.startedAt).toLocaleDateString()}`
                        : "Not started"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      cycle.status === "completed"
                        ? "default"
                        : cycle.status === "running"
                          ? "secondary"
                          : cycle.status === "failed"
                            ? "destructive"
                            : "outline"
                    }
                  >
                    {cycle.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
