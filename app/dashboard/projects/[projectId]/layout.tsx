import { getProjectByIdAction } from "@/actions/projects-actions"
import { notFound } from "next/navigation"
import { ProjectLayoutClient } from "./_components/project-layout-client"

export default async function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const result = await getProjectByIdAction(projectId)

  if (result.status === "error") {
    notFound()
  }

  const project = result.data

  return (
    <ProjectLayoutClient project={project} projectId={projectId}>
      {children}
    </ProjectLayoutClient>
  )
}
