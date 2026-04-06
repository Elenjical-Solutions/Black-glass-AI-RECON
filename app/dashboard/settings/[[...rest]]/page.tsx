"use client"

import { UserProfile } from "@clerk/nextjs"
import { Card } from "@/components/ui/card"
import { Settings, Database, Key, Bell } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and application preferences
        </p>
      </div>

      {/* Quick info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Database</p>
              <p className="text-xs text-muted-foreground">Connected to Render PostgreSQL</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">AI Engine</p>
              <p className="text-xs text-muted-foreground">Claude Sonnet 4</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">Email on cycle completion</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Clerk User Profile */}
      <Card className="glass-card p-6 overflow-hidden">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Account Management
        </h3>
        <UserProfile
          routing="path"
          path="/dashboard/settings"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "shadow-none w-full max-w-none",
              card: "shadow-none border-0 bg-transparent w-full max-w-none",
              pageScrollBox: "p-0",
              page: "p-0",
            },
          }}
        />
      </Card>
    </div>
  )
}
