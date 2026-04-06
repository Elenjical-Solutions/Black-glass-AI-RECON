"use client"

import { useState, useEffect, useCallback, useRef, use } from "react"
import {
  uploadScreenshotAction,
  getScreenshotsForProjectAction,
  deleteScreenshotAction
} from "@/actions/screenshots-actions"
import { compareScreenshotsAction } from "@/actions/ai-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Camera,
  Upload,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Trash2,
  ImageIcon
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Screenshot } from "@/db/schema/screenshots-schema"

interface ComparisonDifference {
  location: string
  valueA: string
  valueB: string
  likelyCause: string
  severity: "low" | "medium" | "high" | "critical"
}

export default function ScreenshotsPage({
  params
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)

  const [screenshotsA, setScreenshotsA] = useState<Screenshot[]>([])
  const [screenshotsB, setScreenshotsB] = useState<Screenshot[]>([])
  const [selectedA, setSelectedA] = useState<Screenshot | null>(null)
  const [selectedB, setSelectedB] = useState<Screenshot | null>(null)
  const [uploadingA, setUploadingA] = useState(false)
  const [uploadingB, setUploadingB] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [differences, setDifferences] = useState<ComparisonDifference[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)

  const fileInputARef = useRef<HTMLInputElement>(null)
  const fileInputBRef = useRef<HTMLInputElement>(null)

  const loadScreenshots = useCallback(async () => {
    const result = await getScreenshotsForProjectAction(projectId)
    if (result.status === "success") {
      setScreenshotsA(result.data.filter(s => s.systemSide === "source_a"))
      setScreenshotsB(result.data.filter(s => s.systemSide === "source_b"))
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    loadScreenshots()
  }, [loadScreenshots])

  const handleUpload = async (
    file: File,
    side: "source_a" | "source_b"
  ) => {
    const setter = side === "source_a" ? setUploadingA : setUploadingB
    setter(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("projectId", projectId)
    formData.append("label", file.name)
    formData.append("systemSide", side)

    const result = await uploadScreenshotAction(formData)
    setter(false)

    if (result.status === "success") {
      toast.success(`Screenshot uploaded: ${file.name}`)
      loadScreenshots()
      if (side === "source_a") setSelectedA(result.data)
      else setSelectedB(result.data)
    } else {
      toast.error(result.message)
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "source_a" | "source_b"
  ) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file, side)
    e.target.value = ""
  }

  const handleDrop = (
    e: React.DragEvent,
    side: "source_a" | "source_b"
  ) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      handleUpload(file, side)
    }
  }

  const handleCompare = async () => {
    if (!selectedA || !selectedB) {
      toast.error("Select screenshots from both systems to compare")
      return
    }

    setComparing(true)
    setDifferences([])

    const result = await compareScreenshotsAction(
      selectedA.imageData,
      selectedB.imageData
    )

    setComparing(false)

    if (result.status === "success") {
      setDifferences(result.data as unknown as ComparisonDifference[])
      toast.success(`Found ${result.data.length} difference(s)`)
    } else {
      toast.error(result.message)
    }
  }

  const handleDelete = async (id: string, side: "source_a" | "source_b") => {
    const result = await deleteScreenshotAction(id)
    if (result.status === "success") {
      toast.success("Screenshot deleted")
      if (side === "source_a" && selectedA?.id === id) setSelectedA(null)
      if (side === "source_b" && selectedB?.id === id) setSelectedB(null)
      loadScreenshots()
    } else {
      toast.error(result.message)
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25))
  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  const severityColor: Record<string, string> = {
    low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/15 text-red-400 border-red-500/30"
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <h3 className="text-lg font-semibold">Screenshot Comparison</h3>
        <div className="glass-card rounded-xl flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Screenshot Comparison</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.25}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetView}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={!selectedA || !selectedB || comparing}
          >
            {comparing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            Compare with AI
          </Button>
        </div>
      </div>

      {/* Upload zones and thumbnails */}
      <div className="grid grid-cols-2 gap-6">
        {/* System A */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            System A Screenshot
          </h4>

          <div
            className={cn(
              "glass-card rounded-xl border-2 border-dashed border-border/50 p-6 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
              uploadingA && "pointer-events-none opacity-60"
            )}
            onClick={() => fileInputARef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, "source_a")}
          >
            <input
              ref={fileInputARef}
              type="file"
              accept="image/png,image/jpg,image/jpeg"
              className="hidden"
              onChange={e => handleFileChange(e, "source_a")}
            />
            {uploadingA ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop image or click to upload
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  PNG, JPG up to 10MB
                </p>
              </>
            )}
          </div>

          {screenshotsA.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {screenshotsA.map(s => (
                <div
                  key={s.id}
                  className={cn(
                    "relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                    selectedA?.id === s.id
                      ? "border-primary glow-blue"
                      : "border-border/30 hover:border-border/60"
                  )}
                  onClick={() => setSelectedA(s)}
                >
                  <img
                    src={s.imageData}
                    alt={s.label}
                    className="w-16 h-16 object-cover"
                  />
                  <button
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(s.id, "source_a")
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                    <p className="text-[9px] text-white truncate">
                      {s.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System B */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            System B Screenshot
          </h4>

          <div
            className={cn(
              "glass-card rounded-xl border-2 border-dashed border-border/50 p-6 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
              uploadingB && "pointer-events-none opacity-60"
            )}
            onClick={() => fileInputBRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, "source_b")}
          >
            <input
              ref={fileInputBRef}
              type="file"
              accept="image/png,image/jpg,image/jpeg"
              className="hidden"
              onChange={e => handleFileChange(e, "source_b")}
            />
            {uploadingB ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop image or click to upload
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  PNG, JPG up to 10MB
                </p>
              </>
            )}
          </div>

          {screenshotsB.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {screenshotsB.map(s => (
                <div
                  key={s.id}
                  className={cn(
                    "relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                    selectedB?.id === s.id
                      ? "border-primary glow-blue"
                      : "border-border/30 hover:border-border/60"
                  )}
                  onClick={() => setSelectedB(s)}
                >
                  <img
                    src={s.imageData}
                    alt={s.label}
                    className="w-16 h-16 object-cover"
                  />
                  <button
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(s.id, "source_b")
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                    <p className="text-[9px] text-white truncate">
                      {s.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side-by-side preview */}
      {(selectedA || selectedB) && (
        <div
          className="glass-card rounded-xl overflow-hidden"
          style={{ height: "400px" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="grid grid-cols-2 h-full gap-px bg-border/20"
            style={{
              cursor: isDragging ? "grabbing" : "grab"
            }}
          >
            <div className="overflow-hidden relative bg-black/20 flex items-center justify-center">
              {selectedA ? (
                <img
                  src={selectedA.imageData}
                  alt={selectedA.label}
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transition: isDragging ? "none" : "transform 0.15s ease"
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-10 w-10" />
                  <p className="text-sm">Select a System A screenshot</p>
                </div>
              )}
              <div className="absolute top-2 left-2 glass-subtle rounded px-2 py-1 text-xs text-muted-foreground">
                System A
              </div>
            </div>

            <div className="overflow-hidden relative bg-black/20 flex items-center justify-center">
              {selectedB ? (
                <img
                  src={selectedB.imageData}
                  alt={selectedB.label}
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transition: isDragging ? "none" : "transform 0.15s ease"
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-10 w-10" />
                  <p className="text-sm">Select a System B screenshot</p>
                </div>
              )}
              <div className="absolute top-2 left-2 glass-subtle rounded px-2 py-1 text-xs text-muted-foreground">
                System B
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison results */}
      {comparing && (
        <Card className="glass-card p-8 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">
            Analyzing screenshots with AI...
          </p>
        </Card>
      )}

      {differences.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            Identified Differences ({differences.length})
          </h4>
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Location
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Value A
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Value B
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Likely Cause
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {differences.map((diff, index) => (
                    <tr
                      key={index}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {diff.location}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                        {diff.valueA}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                        {diff.valueB}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[250px]">
                        {diff.likelyCause}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase tracking-wider",
                            severityColor[diff.severity] ??
                              severityColor.low
                          )}
                        >
                          {diff.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
