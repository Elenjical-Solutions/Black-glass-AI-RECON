import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Black Glass AI RECON",
  description: "Smart Dependency Reconciliation Tool",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#38bdf8",
          colorBackground: "#1a1f2e",
          colorInputBackground: "#1e2433",
          colorInputText: "#e2e8f0",
        },
        elements: {
          formButtonPrimary:
            "bg-primary hover:bg-primary/90 text-primary-foreground",
          card: "bg-card border border-border/50 shadow-xl",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton:
            "bg-secondary border border-border/50 text-foreground hover:bg-accent",
          formFieldLabel: "text-foreground",
          formFieldInput:
            "bg-input border border-border text-foreground",
          footerActionLink: "text-primary hover:text-primary/80",
          identityPreview: "bg-secondary border border-border/50",
          userButtonPopoverCard: "bg-card border border-border/50",
          userButtonPopoverActionButton: "text-foreground hover:bg-accent",
          userButtonPopoverFooter: "hidden",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
