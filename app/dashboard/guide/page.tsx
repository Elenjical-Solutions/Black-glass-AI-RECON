"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Upload, FileSpreadsheet, GitCompareArrows, Search, Sparkles,
  ArrowRight, ArrowDown, CheckCircle2, RefreshCcw, GitBranch,
  Tag, Download, ChevronDown, ChevronRight, Lightbulb, Zap,
  BookOpen, Play
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface StepProps {
  number: number
  title: string
  subtitle: string
  icon: React.ReactNode
  phase: string
  phaseColor: string
  children: React.ReactNode
  isLast?: boolean
}

function Step({ number, title, subtitle, icon, phase, phaseColor, children, isLast }: StepProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-6 top-[72px] bottom-0 w-px bg-border/50" />
      )}

      <div className="flex gap-4">
        {/* Step number circle */}
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 z-10 bg-background",
          phaseColor
        )}>
          <span className="text-lg font-bold">{number}</span>
        </div>

        {/* Content */}
        <div className="flex-1 pb-8">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn("text-[10px]", phaseColor)}>{phase}</Badge>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-start gap-3 w-full text-left group"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold group-hover:text-primary transition-colors">{title}</h3>
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
            <div className="mt-1 shrink-0 text-muted-foreground/50 group-hover:text-primary/50 transition-colors">
              {icon}
            </div>
          </button>

          {expanded && (
            <Card className="mt-3 p-4 bg-muted/20 border-border/30 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              {children}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
      <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  )
}

function WhereInApp({ path, label }: { path: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Where:</span>
      <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">{path}</code>
      <span className="text-muted-foreground">→ {label}</span>
    </div>
  )
}

export default function GuidePage() {
  const router = useRouter()

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary glow-blue">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">How to Use Black Glass AI RECON</h1>
            <p className="text-sm text-muted-foreground">End-to-end reconciliation workflow — from first file upload to automated key assignment</p>
          </div>
        </div>

        {/* Phase overview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-6">
          {[
            { phase: "Setup", color: "bg-blue-500/10 border-blue-500/30 text-blue-400", icon: <Upload className="h-4 w-4" />, desc: "Upload & configure" },
            { phase: "Discover", color: "bg-purple-500/10 border-purple-500/30 text-purple-400", icon: <Search className="h-4 w-4" />, desc: "Find patterns" },
            { phase: "Define", color: "bg-amber-500/10 border-amber-500/30 text-amber-400", icon: <Tag className="h-4 w-4" />, desc: "Write rules" },
            { phase: "Apply", color: "bg-green-500/10 border-green-500/30 text-green-400", icon: <Sparkles className="h-4 w-4" />, desc: "AI assigns keys" },
            { phase: "Repeat", color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400", icon: <RefreshCcw className="h-4 w-4" />, desc: "Reuse across cycles" },
          ].map((p) => (
            <Card key={p.phase} className={cn("p-3 border text-center", p.color)}>
              <div className="flex justify-center mb-1.5">{p.icon}</div>
              <p className="text-xs font-semibold">{p.phase}</p>
              <p className="text-[10px] opacity-70">{p.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {/* ── PHASE: SETUP ── */}
        <Step
          number={1}
          title="Create a Project"
          subtitle="A project holds all your files, templates, keys, and cycles for one reconciliation exercise"
          icon={<FileSpreadsheet className="h-6 w-6" />}
          phase="Setup"
          phaseColor="border-blue-500/50 text-blue-400"
        >
          <WhereInApp path="Dashboard → Projects → New Project" label="Enter name and description" />
          <p className="text-xs text-muted-foreground">
            Example: <strong>"Murex MX 3.1.58 → 3.1.62 Upgrade"</strong> — one project per upgrade/migration exercise.
          </p>
          <Tip>A project is your workspace. Everything inside — files, templates, keys, cycles — is shared within the project.</Tip>
        </Step>

        <Step
          number={2}
          title="Upload Your Files"
          subtitle="Upload the source (old) and target (new) CSV/XML files you want to compare"
          icon={<Upload className="h-6 w-6" />}
          phase="Setup"
          phaseColor="border-blue-500/50 text-blue-400"
        >
          <WhereInApp path="Project → Files tab" label="Drag & drop or browse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
              <p className="text-xs font-semibold text-blue-400 mb-1">Source A (Old System)</p>
              <p className="text-[11px] text-muted-foreground">The baseline — data from the current/old version</p>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
              <p className="text-xs font-semibold text-cyan-400 mb-1">Source B (New System)</p>
              <p className="text-[11px] text-muted-foreground">The target — data from the upgraded/new version</p>
            </div>
          </div>
          <Tip>You can also upload files directly in the Recon Template wizard (Step 3). You don&apos;t have to upload here first.</Tip>
        </Step>

        <Step
          number={3}
          title="Create a Recon Template"
          subtitle="Define HOW to compare: which columns to match, what tolerances to use, which fields are keys"
          icon={<GitCompareArrows className="h-6 w-6" />}
          phase="Setup"
          phaseColor="border-blue-500/50 text-blue-400"
        >
          <WhereInApp path="Project → Definitions → New Recon Template" label="3-step wizard" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Step 1</Badge>
              <span className="text-xs">Select or upload two files — columns detected instantly</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Step 2</Badge>
              <span className="text-xs">Map fields between files — set match type (text/number) and tolerances</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Step 3</Badge>
              <span className="text-xs">Name it, set category (Core/Sensitivity/Downstream), save</span>
            </div>
          </div>
          <Tip>
            Use <strong>"AI Suggest Mappings"</strong> when column names differ between systems (e.g., MtM_Value vs mark_to_market). The AI uses financial domain knowledge to map them.
          </Tip>
          <Tip>Templates are reusable — define once, run against different file pairs in every cycle.</Tip>
        </Step>

        <Step
          number={4}
          title="Run the Reconciliation"
          subtitle="Execute your template against the files — the engine compares every row field by field"
          icon={<Play className="h-6 w-6" />}
          phase="Setup"
          phaseColor="border-blue-500/50 text-blue-400"
        >
          <WhereInApp path="Definition detail page → Run Now" label="Pick files and click Run" />
          <p className="text-xs text-muted-foreground">
            You can also run from <strong>Cycles → Run with Files</strong>. The &quot;Run Now&quot; shortcut on the definition page is fastest.
          </p>
          <p className="text-xs text-muted-foreground">
            Results show: <span className="text-green-400">Matched</span>, <span className="text-red-400">Breaks</span>,
            <span className="text-amber-400"> Missing A</span>, <span className="text-orange-400">Missing B</span>.
            All breaks start <strong>unassigned</strong> — no explanation keys yet.
          </p>
        </Step>

        {/* ── PHASE: DISCOVER ── */}
        <Step
          number={5}
          title="Discover Break Patterns"
          subtitle="AI analyzes all breaks and clusters them by similarity — helps you understand WHAT happened"
          icon={<Search className="h-6 w-6" />}
          phase="Discover"
          phaseColor="border-purple-500/50 text-purple-400"
        >
          <WhereInApp path="Results page → Discover Patterns button" label="AI clusters your breaks" />
          <p className="text-xs text-muted-foreground">
            The AI looks at all breaks holistically and groups them:
          </p>
          <div className="space-y-1.5 pl-2 border-l-2 border-purple-500/20">
            <p className="text-xs text-muted-foreground"><em>"30 IR trades where DV01 shifted 2-5% and MV moved proportionally"</em></p>
            <p className="text-xs text-muted-foreground"><em>"20 options where vega changed 8-15%"</em></p>
            <p className="text-xs text-muted-foreground"><em>"5 anomalies with huge MV diffs and no sensitivity correlation"</em></p>
          </div>
          <div className="flex gap-2 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
            <Search className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>This is analysis only</strong> — it does NOT assign explanation keys. It tells you what patterns exist so you can write informed rules.
            </p>
          </div>
        </Step>

        {/* ── PHASE: DEFINE ── */}
        <Step
          number={6}
          title="Write Natural Language Rules"
          subtitle="For each explanation key, describe WHEN it should apply in plain English"
          icon={<Tag className="h-6 w-6" />}
          phase="Define"
          phaseColor="border-amber-500/50 text-amber-400"
        >
          <WhereInApp path="Project → Explanation Keys → Edit key → AI Rule field" label="Write your rules" />
          <p className="text-xs text-muted-foreground mb-2">Based on what you discovered in Step 5, write rules like:</p>
          <div className="space-y-2">
            <Card className="p-2.5 bg-background/50">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <code className="text-[10px] bg-muted px-1 py-0.5 rounded">BOOTSTRAP_METHOD</code>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                &quot;For interest rate products (IRS, Bond, Deposit) where DV01 has shifted by 2-5% and market value moved proportionally, this is caused by the IR curve bootstrap methodology change.&quot;
              </p>
            </Card>
            <Card className="p-2.5 bg-background/50">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <code className="text-[10px] bg-muted px-1 py-0.5 rounded">VOL_SURFACE_INTERP</code>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                &quot;For options where vega shifted 8-15% and theta changed 3-8%, with MV following the vega shift, this is the volatility surface interpolation change.&quot;
              </p>
            </Card>
          </div>
          <Tip>
            Rules support complex conditions: product type, currency, field combinations, percentages. A single break can match MULTIPLE keys.
          </Tip>
          <Tip>
            Once defined, these rules persist across all future cycles in this project. Define once, apply many times.
          </Tip>
        </Step>

        {/* ── PHASE: APPLY ── */}
        <Step
          number={7}
          title="Apply My Rules"
          subtitle="AI reads your natural language rules and assigns explanation keys to every break"
          icon={<Sparkles className="h-6 w-6" />}
          phase="Apply"
          phaseColor="border-green-500/50 text-green-400"
        >
          <WhereInApp path="Results page → Apply My Rules button" label="AI assigns keys based on YOUR rules" />
          <p className="text-xs text-muted-foreground">
            The AI evaluates each break against ALL your natural language rules and assigns every key that matches.
            Each assignment includes a confidence score and per-field reasoning.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-2.5 bg-background/50">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Single Key</p>
              <div className="flex gap-1">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">BOOTSTRAP_METHOD</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Most breaks get one key</p>
            </Card>
            <Card className="p-2.5 bg-background/50">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Multiple Keys</p>
              <div className="flex gap-1">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">BOOTSTRAP</Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">DAYCOUNT</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Some trades have compound causes</p>
            </Card>
          </div>
        </Step>

        <Step
          number={8}
          title="Export & Review"
          subtitle="Download results as CSV, review AI reasoning, adjust any misassigned keys manually"
          icon={<Download className="h-6 w-6" />}
          phase="Apply"
          phaseColor="border-green-500/50 text-green-400"
        >
          <WhereInApp path="Results page → Export CSV" label="Download with all keys and AI reasoning" />
          <p className="text-xs text-muted-foreground">
            Expand any row to see field-by-field diffs and the AI&apos;s reasoning for each assigned key.
            Override manually if needed — click the key dropdown on any row.
          </p>
        </Step>

        {/* ── PHASE: REPEAT ── */}
        <Step
          number={9}
          title="Next Cycle — Reuse Everything"
          subtitle="Upload new files, same templates, same rules — just click Apply"
          icon={<RefreshCcw className="h-6 w-6" />}
          phase="Repeat"
          phaseColor="border-cyan-500/50 text-cyan-400"
        >
          <p className="text-xs text-muted-foreground">
            In the next regression cycle:
          </p>
          <ol className="space-y-1.5 pl-4 list-decimal">
            <li className="text-xs text-muted-foreground">Upload new cycle&apos;s files (same template works)</li>
            <li className="text-xs text-muted-foreground">Run the reconciliation</li>
            <li className="text-xs text-muted-foreground">Click <strong>&quot;Apply My Rules&quot;</strong> — your existing NL rules assign keys instantly</li>
            <li className="text-xs text-muted-foreground">Only investigate NEW patterns that don&apos;t match existing rules</li>
          </ol>
          <div className="flex gap-2 p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
            <Zap className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>First cycle: 2 hours</strong> (discover + write rules). <strong>Every subsequent cycle: 2 minutes</strong> (upload + run + apply).
            </p>
          </div>
        </Step>

        <Step
          number={10}
          title="Propagate to Downstream Reports"
          subtitle="Explanation keys flow from core/sensitivity recons to all dependent downstream reports"
          icon={<GitBranch className="h-6 w-6" />}
          phase="Repeat"
          phaseColor="border-cyan-500/50 text-cyan-400"
          isLast
        >
          <WhereInApp path="Project → Dependencies tab → Propagate All" label="Push keys downstream" />
          <p className="text-xs text-muted-foreground">
            Once core and sensitivity recons are explained, click <strong>Propagate All</strong> to auto-attribute the same explanations to downstream reports (Daily P&L, VaR, FRTB, etc.).
          </p>
          <Tip>
            If an FX delta difference is explained as FX_RATE_SOURCE in the core recon, every downstream report containing that same FX delta gets the same key automatically.
          </Tip>
        </Step>
      </div>

      {/* Footer CTA */}
      <Card className="mt-8 p-6 glass-card border-primary/20 glow-blue text-center">
        <h3 className="text-lg font-semibold mb-2">Ready to start?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create a project and upload your first files to begin.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/dashboard/projects">
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Go to Projects
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
