import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="glass-card rounded-2xl p-12 text-center">
        <h1 className="text-6xl font-bold text-gradient">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Page not found
        </p>
        <p className="mt-2 text-sm text-muted-foreground/70">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 glow-blue"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
