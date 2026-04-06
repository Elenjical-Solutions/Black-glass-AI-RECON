"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"

/**
 * Wraps ClerkProvider so it reacts to next-themes dark/light switching.
 * Must be rendered *inside* ThemeProvider so useTheme() works.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: isDark
          ? {
              colorPrimary: "#38bdf8",
              colorBackground: "#1a1f2e",
              colorInputBackground: "#1e2433",
              colorInputText: "#e2e8f0",
              colorText: "#e2e8f0",
              colorTextSecondary: "#94a3b8",
              colorNeutral: "#e2e8f0",
            }
          : {
              colorPrimary: "#2563eb",
              colorBackground: "#ffffff",
              colorInputBackground: "#f8fafc",
              colorInputText: "#0f172a",
              colorText: "#0f172a",
              colorTextSecondary: "#475569",
              colorNeutral: "#0f172a",
            },
        elements: {
          formButtonPrimary: isDark
            ? "bg-sky-500 hover:bg-sky-400 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white",
          card: isDark
            ? "bg-[#1a1f2e] border border-slate-700/50 shadow-xl"
            : "bg-white border border-slate-200 shadow-lg",
          headerTitle: isDark ? "text-slate-100" : "text-slate-900",
          headerSubtitle: isDark ? "text-slate-400" : "text-slate-500",
          socialButtonsBlockButton: isDark
            ? "bg-slate-800 border border-slate-700/50 text-slate-200 hover:bg-slate-700"
            : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100",
          formFieldLabel: isDark ? "text-slate-200" : "text-slate-700",
          formFieldInput: isDark
            ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400",
          footerActionLink: isDark
            ? "text-sky-400 hover:text-sky-300"
            : "text-blue-600 hover:text-blue-700",
          identityPreview: isDark
            ? "bg-slate-800 border-slate-700/50"
            : "bg-slate-50 border-slate-200",
          userButtonPopoverCard: isDark
            ? "bg-[#1a1f2e] border border-slate-700/50"
            : "bg-white border border-slate-200 shadow-lg",
          userButtonPopoverActionButton: isDark
            ? "text-slate-200 hover:bg-slate-800"
            : "text-slate-700 hover:bg-slate-100",
          userButtonPopoverFooter: "hidden",
          // UserProfile inside settings
          profileSectionPrimaryButton: isDark
            ? "text-sky-400 hover:text-sky-300"
            : "text-blue-600 hover:text-blue-700",
          badge: isDark
            ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
            : "bg-blue-100 text-blue-700 border-blue-200",
          menuButton: isDark
            ? "text-slate-300 hover:bg-slate-800"
            : "text-slate-600 hover:bg-slate-100",
          menuList: isDark
            ? "bg-[#1a1f2e] border-slate-700/50"
            : "bg-white border-slate-200",
          menuItem: isDark
            ? "text-slate-200 hover:bg-slate-800"
            : "text-slate-700 hover:bg-slate-50",
          navbarButton: isDark
            ? "text-slate-300 hover:bg-slate-800"
            : "text-slate-600 hover:bg-slate-100",
          pageScrollBox: isDark ? "bg-transparent" : "bg-transparent",
          page: isDark ? "text-slate-200" : "text-slate-800",
          profilePage: isDark ? "text-slate-200" : "text-slate-800",
          formFieldSuccessText: isDark ? "text-emerald-400" : "text-emerald-600",
          formFieldErrorText: isDark ? "text-red-400" : "text-red-600",
          alertText: isDark ? "text-slate-200" : "text-slate-700",
          modalCloseButton: isDark
            ? "text-slate-400 hover:text-slate-200"
            : "text-slate-500 hover:text-slate-700",
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
