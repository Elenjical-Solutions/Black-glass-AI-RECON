import Link from "next/link"
import { getProjectsAction } from "@/actions/projects-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FolderKanban, Plus, Calendar } from "lucide-react"
import { format } from "date-fns"

export default async function ProjectsPage() {
  const result = await getProjectsAction()
  const projects = result.status === "success" ? result.data : []

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your reconciliation projects
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Create your first reconciliation project to get started with
            comparing and analyzing data sources.
          </p>
          <Link href="/dashboard/projects/new" className="mt-6">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
            >
              <Card className="glass-card p-6 transition-all duration-200 hover:border-primary/30 hover:glow-blue cursor-pointer group h-full">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Created{" "}
                    {format(new Date(project.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
