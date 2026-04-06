"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"
import type { ReconciliationProject } from "@/db/schema/projects-schema"

const tabs = [
  { label: "Overview", segment: "" },
  { label: "Files", segment: "/files" },
  { label: "Definitions", segment: "/definitions" },
  { label: "Dependencies", segment: "/dependencies" },
  { label: "Explanation Keys", segment: "/explanation-keys" },
  { label: "Cycles", segment: "/cycles" },
  { label: "Screenshots", segment: "/screenshots" }
]

export function ProjectLayoutClient({
  children,
  project,
  projectId
}: {
  children: React.ReactNode
  project: ReconciliationProject
  projectId: string
}) {
  const pathname = usePathname()
  const basePath = `/dashboard/projects/${projectId}`

  function isActive(segment: string) {
    const fullPath = basePath + segment
    if (segment === "") {
      return pathname === basePath
    }
    return pathname === fullPath || pathname.startsWith(fullPath + "/")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="p-6 lg:px-8 pb-0">
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Projects
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}

          {/* Tab navigation */}
          <nav className="flex gap-0 mt-4 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <Link
                key={tab.segment}
                href={basePath + tab.segment}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  isActive(tab.segment)
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
