import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { ClerkThemeProvider } from "@/components/utility/clerk-theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Black Glass AI RECON",
  description: "Smart Dependency Reconciliation Tool",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ClerkThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
