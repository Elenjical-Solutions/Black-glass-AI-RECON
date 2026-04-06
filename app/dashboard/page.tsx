"use client"

import {
  FolderKanban,
  RefreshCcw,
  TrendingUp,
  Sparkles,
  Plus,
  Upload,
  ArrowUpRight,
  Activity,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const stats = [
  {
    title: "Total Projects",
    value: "12",
    change: "+2 this week",
    icon: FolderKanban,
    glowClass: "glow-blue",
    iconColor: "text-blue-400",
  },
  {
    title: "Active Cycles",
    value: "5",
    change: "3 pending review",
    icon: RefreshCcw,
    glowClass: "glow-cyan",
    iconColor: "text-cyan-400",
  },
  {
    title: "Match Rate",
    value: "94.7%",
    change: "+1.2% from last cycle",
    icon: TrendingUp,
    glowClass: "glow-green",
    iconColor: "text-emerald-400",
  },
  {
    title: "AI Insights",
    value: "28",
    change: "7 unreviewed",
    icon: Sparkles,
    glowClass: "glow-purple",
    iconColor: "text-purple-400",
  },
]

const recentActivity = [
  {
    action: "Cycle completed",
    project: "Q1 Revenue Recon",
    time: "2 hours ago",
    status: "success",
  },
  {
    action: "Files uploaded",
    project: "Vendor Payments",
    time: "4 hours ago",
    status: "info",
  },
  {
    action: "Discrepancy flagged",
    project: "Intercompany Transfers",
    time: "6 hours ago",
    status: "warning",
  },
  {
    action: "AI review complete",
    project: "Monthly Close - March",
    time: "1 day ago",
    status: "success",
  },
  {
    action: "New project created",
    project: "AP Aging Analysis",
    time: "2 days ago",
    status: "info",
  },
]

const statusColors: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of your reconciliation workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/projects">
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Files
            </Button>
          </Link>
          <Link href="/dashboard/projects">
            <Button className="gap-2 glow-blue">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className={`glass-card rounded-xl transition-all duration-300 hover:scale-[1.02] ${stat.glowClass}`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Activity */}
        <Card className="glass-card rounded-xl lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest actions across your projects</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-4 py-3 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className={statusColors[item.status]}
                    >
                      {item.action}
                    </Badge>
                    <span className="text-sm font-medium">{item.project}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass-card rounded-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            <CardDescription>Jump right into common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/dashboard/projects"
              className="group flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-4 py-3 transition-all hover:bg-accent/30 hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                  <Plus className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Create Project</p>
                  <p className="text-xs text-muted-foreground">Start a new reconciliation</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <Link
              href="/dashboard/projects"
              className="group flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-4 py-3 transition-all hover:bg-accent/30 hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/10">
                  <Upload className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Upload Files</p>
                  <p className="text-xs text-muted-foreground">Add source data files</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <Link
              href="/dashboard/projects"
              className="group flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-4 py-3 transition-all hover:bg-accent/30 hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10">
                  <RefreshCcw className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Run Cycle</p>
                  <p className="text-xs text-muted-foreground">Execute reconciliation</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <Link
              href="/dashboard/projects"
              className="group flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-4 py-3 transition-all hover:bg-accent/30 hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">AI Insights</p>
                  <p className="text-xs text-muted-foreground">Review AI suggestions</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
