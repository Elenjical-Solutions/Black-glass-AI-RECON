"use client"

import { cn } from "@/lib/utils"

interface SummaryStatsCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  variant?: "default" | "success" | "danger" | "warning" | "info"
}

const variantStyles: Record<
  NonNullable<SummaryStatsCardProps["variant"]>,
  { glow: string; iconBg: string; iconColor: string; valueColor: string }
> = {
  default: {
    glow: "",
    iconBg: "bg-muted/50",
    iconColor: "text-muted-foreground",
    valueColor: "text-foreground"
  },
  success: {
    glow: "glow-green",
    iconBg: "bg-green-500/10",
    iconColor: "text-green-400",
    valueColor: "text-green-400"
  },
  danger: {
    glow: "glow-red",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    valueColor: "text-red-400"
  },
  warning: {
    glow: "glow-purple",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    valueColor: "text-amber-400"
  },
  info: {
    glow: "glow-cyan",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
    valueColor: "text-cyan-400"
  }
}

export function SummaryStatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default"
}: SummaryStatsCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "glass-card rounded-xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.02]",
        styles.glow
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "rounded-lg p-2",
            styles.iconBg
          )}
        >
          <Icon className={cn("h-4 w-4", styles.iconColor)} />
        </div>
      </div>

      <div className="space-y-1">
        <p
          className={cn(
            "text-2xl font-bold tracking-tight",
            styles.valueColor
          )}
        >
          {value}
        </p>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
