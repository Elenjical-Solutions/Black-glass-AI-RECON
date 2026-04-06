"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FilterState } from "./filter-bar"

export interface DefinitionWithStats {
  id: string
  name: string
  description: string | null
  category: string | null
  department: string | null
  runStatus: string | null
  runSummary: any | null
  runId: string | null
}

interface TreeBrowserProps {
  definitions: DefinitionWithStats[]
  selectedId: string | null
  onSelect: (id: string) => void
  filters: FilterState
}

interface GroupedDefinitions {
  category: string
  label: string
  departments: {
    department: string
    definitions: DefinitionWithStats[]
  }[]
}

const categoryOrder = ["core", "sensitivity", "downstream"]
const categoryLabels: Record<string, string> = {
  core: "Core Reconciliation",
  sensitivity: "Sensitivities",
  downstream: "Downstream Reports",
}

function extractBreaks(def: DefinitionWithStats): number {
  if (!def.runSummary) return 0
  const summary = typeof def.runSummary === "string" ? JSON.parse(def.runSummary) : def.runSummary
  return summary.breaks ?? summary.totalBreaks ?? 0
}

function extractExplainedPct(def: DefinitionWithStats): number {
  if (!def.runSummary) return 0
  const summary = typeof def.runSummary === "string" ? JSON.parse(def.runSummary) : def.runSummary
  const breaks = summary.breaks ?? summary.totalBreaks ?? 0
  const explained = summary.explained ?? summary.totalExplained ?? 0
  if (breaks === 0) return 100
  return Math.round((explained / breaks) * 100)
}

function getStatusDot(def: DefinitionWithStats): string {
  if (!def.runId) return "bg-gray-500"
  const breaks = extractBreaks(def)
  return breaks > 0 ? "bg-red-400" : "bg-green-400"
}

function getStatusGlow(def: DefinitionWithStats): string {
  if (!def.runId) return ""
  const breaks = extractBreaks(def)
  return breaks > 0
    ? "shadow-[0_0_4px_rgba(248,113,113,0.4)]"
    : "shadow-[0_0_4px_rgba(74,222,128,0.4)]"
}

export function TreeBrowser({ definitions, selectedId, onSelect, filters }: TreeBrowserProps) {
  const filtered = useMemo(() => {
    return definitions.filter((def) => {
      if (filters.search && !def.name.toLowerCase().includes(filters.search.toLowerCase())) return false
      const cat = def.category ?? "core"
      if (filters.categories.length > 0 && !filters.categories.includes(cat)) return false
      if (filters.departments.length > 0 && def.department && !filters.departments.includes(def.department)) return false
      if (filters.status !== "all") {
        const breaks = extractBreaks(def)
        const explained = def.runSummary
          ? (typeof def.runSummary === "string" ? JSON.parse(def.runSummary) : def.runSummary).explained ?? 0
          : 0
        if (filters.status === "all_matched" && breaks > 0) return false
        if (filters.status === "has_breaks" && breaks === 0) return false
        if (filters.status === "has_unexplained" && (breaks === 0 || breaks - explained === 0)) return false
      }
      return true
    })
  }, [definitions, filters])

  const grouped = useMemo<GroupedDefinitions[]>(() => {
    const groups: GroupedDefinitions[] = []
    for (const cat of categoryOrder) {
      const catDefs = filtered.filter((d) => (d.category ?? "core") === cat)
      if (catDefs.length === 0) continue
      const deptMap = new Map<string, DefinitionWithStats[]>()
      for (const def of catDefs) {
        const dept = def.department ?? "General"
        if (!deptMap.has(dept)) deptMap.set(dept, [])
        deptMap.get(dept)!.push(def)
      }
      const departments = Array.from(deptMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([department, defs]) => ({ department, definitions: defs }))
      groups.push({ category: cat, label: categoryLabels[cat] ?? cat, departments })
    }
    return groups
  }, [filtered])

  if (grouped.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center">
        No definitions match filters
      </div>
    )
  }

  return (
    <div className="space-y-1 p-2">
      {grouped.map((group) => (
        <CategoryGroup
          key={group.category}
          group={group}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function CategoryGroup({
  group,
  selectedId,
  onSelect,
}: {
  group: GroupedDefinitions
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const totalDefs = group.departments.reduce((sum, d) => sum + d.definitions.length, 0)
  const hasSingleDept = group.departments.length === 1

  const categoryColor = group.category === "core" ? "bg-blue-500" :
    group.category === "sensitivity" ? "bg-purple-500" : "bg-amber-500"

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <div className={cn("w-2 h-2 rounded-full shrink-0", categoryColor)} />
        <span className="text-xs font-semibold text-foreground">{group.label}</span>
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-auto">
          {totalDefs}
        </Badge>
      </button>
      {open && (
        <div className="pl-2">
          {hasSingleDept ? (
            <div className="space-y-0.5 pl-2">
              {group.departments[0].definitions.map((def) => (
                <DefinitionItem
                  key={def.id}
                  definition={def}
                  isSelected={selectedId === def.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            group.departments.map((dept) => (
              <DepartmentGroup
                key={dept.department}
                department={dept.department}
                definitions={dept.definitions}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function DepartmentGroup({
  department,
  definitions,
  selectedId,
  onSelect,
}: {
  department: string
  definitions: DefinitionWithStats[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full py-1 px-2 rounded-md hover:bg-accent/30 transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-[11px] font-medium text-muted-foreground">{department}</span>
        <Badge variant="secondary" className="h-3.5 px-1 text-[9px] ml-auto">
          {definitions.length}
        </Badge>
      </button>
      {open && (
        <div className="pl-4 space-y-0.5">
          {definitions.map((def) => (
            <DefinitionItem
              key={def.id}
              definition={def}
              isSelected={selectedId === def.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DefinitionItem({
  definition,
  isSelected,
  onSelect,
}: {
  definition: DefinitionWithStats
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const breaks = extractBreaks(definition)
  const explainedPct = extractExplainedPct(definition)

  return (
    <button
      onClick={() => onSelect(definition.id)}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left transition-all cursor-pointer",
        isSelected
          ? "bg-accent ring-1 ring-primary/30"
          : "hover:bg-accent/40"
      )}
    >
      <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusDot(definition), getStatusGlow(definition))} />
      <span className="text-xs font-medium truncate flex-1 text-foreground">
        {definition.name.replace(/\s*\([^)]*\)\s*$/, "")}
      </span>
      {breaks > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-semibold">
            {breaks}
          </Badge>
          <div className="w-8 h-1 rounded-full bg-red-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${explainedPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  )
}
