"use client"

import { useState, useRef, useEffect } from "react"
import { Search, ChevronDown, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface FilterState {
  search: string
  categories: string[] // ["core", "sensitivity", "downstream"]
  departments: string[]
  status: "all" | "all_matched" | "has_breaks" | "has_unexplained"
}

interface FilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  availableDepartments: string[]
}

const categoryConfig: Record<string, { label: string; color: string; activeColor: string }> = {
  core: {
    label: "Core",
    color: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    activeColor: "border-blue-500/50 text-blue-300 bg-blue-500/20",
  },
  sensitivity: {
    label: "Sensi",
    color: "border-purple-500/30 text-purple-400 bg-purple-500/10",
    activeColor: "border-purple-500/50 text-purple-300 bg-purple-500/20",
  },
  downstream: {
    label: "Downstream",
    color: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    activeColor: "border-amber-500/50 text-amber-300 bg-amber-500/20",
  },
}

const statusOptions: { value: FilterState["status"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "all_matched", label: "Matched" },
  { value: "has_breaks", label: "Has Breaks" },
  { value: "has_unexplained", label: "Has Unexplained" },
]

export function FilterBar({ filters, onFiltersChange, availableDepartments }: FilterBarProps) {
  const [deptOpen, setDeptOpen] = useState(false)
  const deptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(event.target as Node)) {
        setDeptOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function toggleCategory(category: string) {
    const current = filters.categories
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    onFiltersChange({ ...filters, categories: next })
  }

  function toggleDepartment(dept: string) {
    const current = filters.departments
    const next = current.includes(dept)
      ? current.filter((d) => d !== dept)
      : [...current, dept]
    onFiltersChange({ ...filters, departments: next })
  }

  return (
    <div className="glass-card rounded-lg p-2 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search definitions..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-7 h-7 text-xs bg-transparent"
        />
      </div>

      {/* Category toggles */}
      <div className="flex items-center gap-1">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const isActive = filters.categories.includes(key)
          return (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer",
                isActive ? config.activeColor : "border-border/50 text-muted-foreground/50 bg-transparent opacity-50"
              )}
            >
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Department multi-select dropdown */}
      {availableDepartments.length > 0 && (
        <div className="relative" ref={deptRef}>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setDeptOpen(!deptOpen)}
            className="h-7 text-[11px] gap-1"
          >
            Dept
            {filters.departments.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filters.departments.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
          {deptOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg bg-popover border border-border shadow-lg p-1.5 space-y-0.5">
              {availableDepartments.map((dept) => (
                <label
                  key={dept}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent cursor-pointer text-xs"
                >
                  <Checkbox
                    checked={filters.departments.includes(dept)}
                    onCheckedChange={() => toggleDepartment(dept)}
                  />
                  <span className="text-foreground">{dept}</span>
                </label>
              ))}
              {filters.departments.length > 0 && (
                <button
                  onClick={() => onFiltersChange({ ...filters, departments: [] })}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground w-full"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status select */}
      <Select
        value={filters.status}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, status: val as FilterState["status"] })
        }
      >
        <SelectTrigger size="sm" className="h-7 text-[11px] min-w-[100px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
