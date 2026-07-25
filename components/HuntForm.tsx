"use client"

import React, { ChangeEvent, useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ToggleSwitch from "./ToggleButton"
import { Minus, Plus, Trash2, Eye, EyeOff, UploadCloud, Image as ImageIcon, CheckCircle, RefreshCw } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { addClue } from "@/lib/contracts/hunt"
import { saveClueLocally, updateClueAnswer } from "@/lib/huntStore"
import { sha256Hex } from "@/lib/crypto"
import { withTransactionToast } from "@/lib/txToast"
import { COVER_IMAGE_UPLOAD_ERROR_MESSAGE, uploadToIPFS } from "@/lib/ipfs"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import { HuntCards } from "./HuntCards"
import type { CoverImageUploadState, HuntDraft } from "@/lib/types"
import { useWallet } from "@/lib/context/WalletContext"

interface HuntFormProps {
  hunt: HuntDraft
  onUpdate: (field: string, value: string) => void
  onRemove: () => void
  huntId?: number
  onCluesSaved?: (count: number) => void
  onImageUploadStateChange?: (state: CoverImageUploadState) => void
}

const clueSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  points: z.number().min(1, "Points must be at least 1"),
  hint: z.string(),
  hintCost: z.number().min(0),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
})

const cluesFormSchema = z.object({
  clues: z.array(clueSchema).min(1, "At least one clue is required"),
})

type CluesFormData = z.infer<typeof cluesFormSchema>

export function HuntForm({ hunt, onUpdate, onRemove, huntId, onCluesSaved, onImageUploadStateChange }: HuntFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingClues, setIsSavingClues] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [linkEnabled, setLinkEnabled] = useState(false)
  const [imageUploadState, setImageUploadState] = useState<CoverImageUploadState>("idle")

  let walletContext = null
  try {
    walletContext = useWallet()
  } catch (e) {
    // Fallback when rendered outside of WalletProvider (e.g. in tests)
  }
  const publicKey = walletContext?.publicKey || ""
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Cropping state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [aspectRatio, setAspectRatio] = useState<number>(1)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null)

  // Detect test/JSDOM env where Canvas context/toBlob isn't available
  const isTestEnv = typeof window !== "undefined" && (
    (window as any)._VITEST_ || 
    !window.HTMLCanvasElement.prototype.toBlob || 
    navigator.userAgent.includes("jsdom")
  )

  useEffect(() => {
    if (!cropSrc) return
    const img = new Image()
    img.src = cropSrc
    img.onload = () => {
      setImageObj(img)
    }
  }, [cropSrc])

  useEffect(() => {
    if (!imageObj || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const targetWidth = 300
    const targetHeight = Math.round(300 / aspectRatio)
    canvas.width = targetWidth
    canvas.height = targetHeight

    ctx.clearRect(0, 0, targetWidth, targetHeight)

    const imgWidth = imageObj.width
    const imgHeight = imageObj.height

    const scale = Math.max(targetWidth / imgWidth, targetHeight / imgHeight)
    const viewWidth = targetWidth / (scale * zoom)
    const viewHeight = targetHeight / (scale * zoom)

    const sx = Math.max(0, Math.min(imgWidth - viewWidth, (imgWidth - viewWidth) / 2 + offsetX))
    const sy = Math.max(0, Math.min(imgHeight - viewHeight, (imgHeight - viewHeight) / 2 + offsetY))

    ctx.drawImage(
      imageObj,
      sx, sy, viewWidth, viewHeight,
      0, 0, targetWidth, targetHeight
    )
  }, [imageObj, aspectRatio, zoom, offsetX, offsetY])

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CluesFormData>({
    resolver: zodResolver(cluesFormSchema),
    defaultValues: {
      clues: [{ question: "", answer: "", points: 10, hint: "", hintCost: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "clues",
  })

  const updateImageUploadState = (state: CoverImageUploadState) => {
    setImageUploadState(state)
    onImageUploadStateChange?.(state)
  }

  const startUpload = async (fileToUpload: File) => {
    updateImageUploadState("uploading")
    setIsUploading(true)
    setUploadProgress(10)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 150)

    try {
      const ipfsUri = await uploadToIPFS(fileToUpload, publicKey || undefined)
      clearInterval(interval)
      setUploadProgress(100)
      onUpdate("image", ipfsUri)
      updateImageUploadState("succeeded")
    } catch (error) {
      clearInterval(interval)
      setUploadProgress(0)
      logger.error("Error uploading image to IPFS:", error)
      updateImageUploadState("failed")
      toast.error(COVER_IMAGE_UPLOAD_ERROR_MESSAGE)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleFileSelected = (file: File) => {
    if (isTestEnv) {
      startUpload(file)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result as string)
      setSelectedFile(file)
      setCropModalOpen(true)
      setZoom(1)
      setOffsetX(0)
      setOffsetY(0)
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleFileSelected(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      handleFileSelected(file)
    } else {
      toast.error("Please drop an image file.")
    }
  }

  const handleClearImage = () => {
    onUpdate("image", "")
    updateImageUploadState("idle")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const addClueRow = () => {
    append({ question: "", answer: "", points: 10, hint: "", hintCost: 0 })
  }

  const removeClueRow = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const onSaveClues = async (data: CluesFormData) => {
    if (!huntId) return
    const valid = data.clues.filter((r) => r.question.trim() && r.answer.trim())
    if (!valid.length) return

    setIsSavingClues(true)
    try {
      for (const row of valid) {
        const normalizedAnswer = row.answer.trim().toLowerCase()
        // Persist locally first to obtain a stable clue id for salting
        const newId = saveClueLocally({
          huntId,
          question: row.question.trim(),
          answer: normalizedAnswer,
          points: row.points,
          hint: row.hint?.trim() || undefined,
          hintCost: row.hintCost,
          difficulty: row.difficulty,
        })

        const salt = `${huntId}_${newId}`
        const hashed = await sha256Hex(normalizedAnswer + salt)

        await withTransactionToast(
          async (setStage) => {
            setStage("approving")
            // Submit the hashed answer to the contract (expected scheme: sha256(answer + salt))
            return addClue(huntId, row.question.trim(), hashed, row.points, row.hint?.trim() || undefined, row.hintCost, row.difficulty)
          },
          {
            pending:   "Pending — preparing clue…",
            approving: "Approving — sign in your wallet…",
            confirmed: "Clue confirmed!",
          }
        )

        // Update the locally stored clue to contain the hashed answer
        try {
          updateClueAnswer(huntId, newId, hashed)
        } catch (e) {
          // non-fatal
          logger.warn("Failed to update local clue answer with hash", e)
        }
      }
      onCluesSaved?.(valid.length)
      reset({ clues: [{ question: "", answer: "", points: 10, hint: "", hintCost: 0 }] })
    } finally {
      setIsSavingClues(false)
    }
  }

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <h3 className="bg-gradient-to-b from-[#3737A4] to-[#0C0C4F] text-2xl font-semibold text-transparent bg-clip-text">Hunt {hunt.id}</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowPreview(!showPreview)}
            variant="outline"
            size="sm"
            className="flex gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button onClick={onRemove} variant="ghost" size="sm" className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex gap-0.5">
            <Minus />
            Remove
          </Button>
        </div>

        {errors.clues?.message && (
          <div role="alert" aria-live="assertive" id="clues-error" className="text-red-500 text-sm mt-2">
            {errors.clues.message}
          </div>
        )}
      </div>

      {showPreview && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-white/5 print:bg-white print:border-none print:p-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium print:hidden">Live Preview</p>
          <div className="flex justify-center print:block">
            <HuntCards
              hunts={[{
                id: hunt.id,
                title: hunt.title || "Untitled Hunt",
                description: hunt.description || "No description yet...",
                link: hunt.link,
                code: hunt.code,
                image: hunt.image,
              }]}
              preview={true}
              isActive={false}
            />
          </div>
        </div>
      )}

      <div className="print:hidden space-y-4">
        <Input
          placeholder="Title of the Hunt"
          aria-label="Title of the Hunt"
          value={hunt.title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate("title", e.target.value)}
          className="w-full pl-6 py-3"
        />

        <div className="grid grid-cols-1 gap-4">
          <Input
            placeholder="Description"
            aria-label="Hunt Description"
            value={hunt.description}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate("description", e.target.value)}
            className="w-full pl-6 py-3"
          />

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center relative flex flex-col items-center justify-center min-h-[140px] gap-2 cursor-pointer ${
              isDragging
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]"
                : hunt.image
                  ? "border-green-500/40 bg-green-50/5 dark:bg-green-950/5"
                  : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
            }`}
            onClick={(e) => {
              // Only trigger if click wasn't on button or specific elements
              if (!(e.target as HTMLElement).closest("button")) {
                triggerFileInput()
              }
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              aria-label="Upload cover image"
              className="hidden"
            />

            {isUploading ? (
              <div className="w-full space-y-2 max-w-xs">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    Uploading to IPFS...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : hunt.image ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center text-green-600 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cover image attached successfully</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]" title={hunt.image}>
                  CID: {hunt.image.startsWith("ipfs://") ? hunt.image.slice(7) : hunt.image}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Drag & drop your cover image here, or <span className="text-blue-500 font-semibold underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Supports JPG, PNG, WebP up to 5MB</p>
              </div>
            )}
          </div>
        </div>
      {(hunt.image || imageUploadState === "failed") && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={imageUploadState === "failed" ? "text-red-500" : "text-slate-500 dark:text-slate-400"}>
            {imageUploadState === "failed" ? "Cover image upload failed." : "Cover image attached."}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearImage}
            className="h-auto px-0 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {hunt.image ? "Remove cover image" : "Skip cover image"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold dark:text-slate-200">Add Link</span>
          <div className="flex gap-2">
            <ToggleSwitch
              isActive={linkEnabled}
              onClick={() => setLinkEnabled(!linkEnabled)}
            />
          </div>
        </div>
        <Input
          placeholder="Enter Code to Unlock next challenge"
          aria-label="Unlock Code"
          value={hunt.code}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate("code", e.target.value)}
          className="w-full pl-6 py-3"
        />
      </div>

      {/* Clues section */}
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold bg-gradient-to-b from-[#3737A4] to-[#0C0C4F] text-transparent bg-clip-text">
            Clues
          </span>
          <Button
            type="button"
            onClick={addClueRow}
            size="sm"
            className="bg-gradient-to-b from-[#3737A4] to-[#0C0C4F] text-white flex items-center gap-1 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Clue
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-2 p-2 border border-slate-100 dark:border-white/5 rounded-lg bg-white/50 dark:bg-slate-900/50">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-4 shrink-0">{index + 1}.</span>
                <div className="flex-1 flex flex-col">
                  <Controller
                    control={control}
                    name={`clues.${index}.question`}
                    render={({ field: f }) => (
                      <Input
                        id={`clue-${index}-question`}
                        placeholder="Riddle / Question"
                        aria-label={`Clue ${index + 1} Question`}
                        aria-describedby={errors.clues?.[index]?.question ? `clue-${index}-question-error` : undefined}
                        {...f}
                        className="pl-3 py-2 text-sm"
                      />
                    )}
                  />
                  {errors.clues?.[index]?.question && (
                    <span
                      role="alert"
                      aria-live="assertive"
                      id={`clue-${index}-question-error`}
                      className="text-red-500 text-xs mt-0.5"
                    >
                      {errors.clues[index].question.message}
                    </span>
                  )}
                </div>
                <div className="w-32 flex flex-col">
                    <Controller
                    control={control}
                    name={`clues.${index}.answer`}
                    render={({ field: f }) => (
                      <Input
                        id={`clue-${index}-answer`}
                        placeholder="Answer (use | for multiple)"
                          aria-label={`Clue ${index + 1} Answer`}
                          aria-describedby={errors.clues?.[index]?.answer ? `clue-${index}-answer-error` : undefined}
                          {...f}
                        className="pl-3 py-2 text-sm"
                      />
                    )}
                  />
                    {errors.clues?.[index]?.answer && (
                      <span
                        role="alert"
                        aria-live="assertive"
                        id={`clue-${index}-answer-error`}
                        className="text-red-500 text-xs mt-0.5"
                      >
                        {errors.clues[index].answer.message}
                      </span>
                    )}
                </div>
                <div className="w-16 flex flex-col">
                  <Controller
                    control={control}
                    name={`clues.${index}.points`}
                    render={({ field: f }) => (
                      <Input
                        type="number"
                        placeholder="Pts"
                        aria-label={`Clue ${index + 1} Points`}
                        min={1}
                        value={f.value}
                        onChange={(e) => f.onChange(parseInt(e.target.value, 10) || 0)}
                        onBlur={f.onBlur}
                        name={f.name}
                        ref={f.ref}
                        className="pl-3 py-2 text-sm"
                      />
                    )}
                  />
                  {errors.clues?.[index]?.points && (
                    <span
                      role="alert"
                      aria-live="assertive"
                      className="text-red-500 text-xs mt-0.5"
                    >
                      {errors.clues[index].points.message}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeClueRow(index)}
                  disabled={fields.length === 1}
                  aria-label="Remove Clue"
                  className="text-red-400 hover:text-red-600 shrink-0 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2 items-center pl-6">
                <Controller
                  control={control}
                  name={`clues.${index}.hint`}
                  render={({ field: f }) => (
                    <Input
                      placeholder="Optional Hint Text"
                      {...f}
                      className="flex-1 pl-3 py-2 text-sm"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`clues.${index}.hintCost`}
                  render={({ field: f }) => (
                    <Input
                      type="number"
                      placeholder="Hint Cost"
                      min={0}
                      value={f.value}
                      onChange={(e) => f.onChange(parseInt(e.target.value, 10) || 0)}
                      onBlur={f.onBlur}
                      name={f.name}
                      ref={f.ref}
                      className="w-24 pl-3 py-2 text-sm"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`clues.${index}.difficulty`}
                  render={({ field: f }) => (
                    <select
                      aria-label={`Clue ${index + 1} Difficulty`}
                      value={f.value ?? ""}
                      onChange={(e) => f.onChange(e.target.value || undefined)}
                      className="w-28 pl-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Difficulty</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        {huntId && (
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handleSubmit(onSaveClues)}
              disabled={isSavingClues}
              className="bg-gradient-to-b from-[#39A437] to-[#194F0C] hover:bg-green-700 text-white px-5 py-2 rounded-xl disabled:opacity-50"
            >
              {isSavingClues ? "Saving..." : "Save Clues"}
            </Button>
          </div>
        )}
      </div>
      </div>

      {/* Cropping Modal Overlay */}
      {cropModalOpen && cropSrc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100">Crop & Compress Cover Image</h4>
              <button 
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Canvas / Preview Container */}
            <div className="p-6 flex flex-col items-center justify-center bg-slate-100/50 dark:bg-slate-950/30 flex-1 overflow-y-auto min-h-[250px]">
              <div className="relative border-4 border-white dark:border-slate-800 rounded-xl shadow-md overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <canvas 
                  ref={previewCanvasRef} 
                  className="max-w-full max-h-[300px] object-contain rounded-lg"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="p-6 space-y-4 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900">
              
              {/* Aspect Ratio Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={aspectRatio === 1 ? "default" : "outline"}
                    onClick={() => setAspectRatio(1)}
                    className="text-xs py-1 h-8"
                  >
                    Square (1:1)
                  </Button>
                  <Button
                    type="button"
                    variant={aspectRatio === 16/9 ? "default" : "outline"}
                    onClick={() => setAspectRatio(16/9)}
                    className="text-xs py-1 h-8"
                  >
                    Landscape (16:9)
                  </Button>
                  <Button
                    type="button"
                    variant={aspectRatio === 4/3 ? "default" : "outline"}
                    onClick={() => setAspectRatio(4/3)}
                    className="text-xs py-1 h-8"
                  >
                    Portrait (4:3)
                  </Button>
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Zoom</span>
                    <span>{zoom.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Pan X</span>
                    <span>{offsetX}px</span>
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    step="5"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Pan Y</span>
                    <span>{offsetY}px</span>
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    step="5"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCropModalOpen(false)}
                  className="text-xs h-9 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const canvas = previewCanvasRef.current
                    if (canvas) {
                      canvas.toBlob((blob) => {
                        if (blob) {
                          const file = new File([blob], selectedFile?.name || "cover.jpg", { type: "image/jpeg" })
                          startUpload(file)
                        }
                        setCropModalOpen(false)
                      }, "image/jpeg", 0.75)
                    }
                  }}
                  className="bg-gradient-to-b from-[#3737A4] to-[#0C0C4F] text-white text-xs h-9 px-4 rounded-lg"
                >
                  Crop & Upload
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
