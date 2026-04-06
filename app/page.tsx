import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8 max-w-lg px-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary glow-blue">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">
            Black Glass AI RECON
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Smart Dependency Reconciliation Tool
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            AI-powered financial reconciliation with dependency tree tracking,
            auto-explanation of differences, and intelligent field mapping.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors glow-blue"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground pt-8">
          by Elenjical Solutions
        </p>
      </div>
    </div>
  )
}
