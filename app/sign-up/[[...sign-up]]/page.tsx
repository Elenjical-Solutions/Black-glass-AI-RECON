import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gradient">
            Black Glass AI RECON
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your account to get started
          </p>
        </div>

        <SignUp
          forceRedirectUrl="/dashboard"
          signInUrl="/sign-in"
        />

        <p className="text-xs text-muted-foreground">
          by Elenjical Solutions
        </p>
      </div>
    </div>
  )
}
