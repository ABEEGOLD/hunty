"use client"

import React, { ChangeEvent, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ToggleSwitch from "./ToggleButton"
import { ChevronDown, ChevronUp, Minus, Plus, Trash2, Eye, EyeOff } from "lucide-react"
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
import type { ClueHint, CoverImageUploadState, HuntDraft } from "@/lib/types"

interface HuntFormProps {
  hunt: HuntDraft
  onUpdate: (field: string, value: string) => void
  onRemove: () => void
  huntId?: number
  onCluesSaved?: (count: number) => void
  onImageUploadStateChange?: (state: CoverImageUploadState) => void
}

/** Maximum number of progressive hints per clue. */
const MAX_HINTS = 3

const hintSchema = z.object({
  text: z.string().min(1, "Hint text is required"),
  penalty: z.number().min(0, "Penalty must be 0 or more"),
  delaySeconds: z.number().min(0, "Delay must be 0 or more"),
})

const clueSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  points: z.number().min(1, "Points must be at least 1"),
  hints: z.array(hintSchema).max(MAX_HINTS),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
})

const cluesFormSchema = z.object({
  clues: z.array(clueSchema).min(1, "At least one clue is required"),
})

type CluesFormData = z.infer<typeof cluesFormSchema>

const DEFAULT_CLUE = {
  question: "",
  answer: "",
  points: 10,
  hints: [] as z.infer<typeof hintSchema>[],
  difficulty: undefined as "Easy" | "Medium" | "Hard" | undefined,
}

/** Sub-component that renders the hints array for one clue row. */
function ClueHintsEditor({
  clueIndex,
  control,
  errors,
}: {
  clueIndex: number
  control: ReturnType<typeof useForm<CluesFormData>>["control"]
  errors: ReturnType<typeof useForm<CluesFormData>>["formState"]["errors"]
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `clues.${clueIndex}.hints`,
  })

  const canAddHint = fields.length < MAX_HINTS

  return (
    <div className="flex flex-col gap-2 pl-6">
      {fields.map((hintField, hIdx) => {
        const hintErrors = errors.clues?.[clueIndex]?.hints?.[hIdx]
        return (
          <div
            key={hintField.id}
            className="flex flex-col gap-1 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10"
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 shrink-0">
                Hint {hIdx + 1}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-1">
                {hIdx === 0 ? "— revealed first" : hIdx === 1 ? "— revealed second" : "— revealed last"}
              </span>
              <button
                type="button"
                onClick={() => remove(hIdx)}
                className="text-red-400 hover:text-red-600 p-0.5 rounded"
                aria-label={`Remove hint ${hIdx + 1} from clue ${clueIndex + 1}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Hint text */}
            <Controller
              control={control}
              name={`clues.${clueIndex}.hints.${hIdx}.text`}
              render={({ field: f }) => (
                <Input
                  placeholder={`Hint ${hIdx + 1} text…`}
                  aria-label={`Clue ${clueIndex + 1} hint ${hIdx + 1} text`}
                  {...f}
                  className="pl-3 py-1.5 text-xs"
                />
              )}
            />
            {hintErrors?.text && (
              <span role="alert" className="text-red-500 text-xs">
                {hintErrors.text.message}
              </span>
            )}

            {/* Penalty + delay on one row */}
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col">
                <Controller
                  control={control}
                  name={`clues.${clueIndex}.hints.${hIdx}.penalty`}
                  render={({ field: f }) => (
                    <Input
                      type="number"
                      placeholder="Penalty pts"
                      aria-label={`Clue ${clueIndex + 1} hint ${hIdx + 1} score penalty`}
                      min={0}
                      value={f.value}
                      onChange={(e) => f.onChange(parseInt(e.target.value, 10) || 0)}
                      onBlur={f.onBlur}
                      name={f.name}
                      ref={f.ref}
                      className="pl-3 py-1.5 text-xs"
                    />
                  )}
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">pts deducted</span>
              </div>
              <div className="flex-1 flex flex-col">
                <Controller
                  control={control}
                  name={`clues.${clueIndex}.hints.${hIdx}.delaySeconds`}
                  render={({ field: f }) => (
                    <Input
                      type="number"
                      placeholder="Delay (s)"
                      aria-label={`Clue ${clueIndex + 1} hint ${hIdx + 1} reveal delay in seconds`}
                      min={0}
                      value={f.value}
                      onChange={(e) => f.onChange(parseInt(e.target.value, 10) || 0)}
                      onBlur={f.onBlur}
                      name={f.name}
                      ref={f.ref}
                      className="pl-3 py-1.5 text-xs"
                    />
                  )}
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {hIdx === 0 ? "wait before hint 1" : `wait after hint ${hIdx}`}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {canAddHint && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ text: "", penalty: 0, delaySeconds: 30 })}
          className="self-start text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 gap-1"
          aria-label={`Add hint to clue ${clueIndex + 1}`}
        >
          <Plus className="w-3 h-3" />
          Add Hint {fields.length > 0 ? `(${fields.length}/${MAX_HINTS})` : ""}
        </Button>
      )}

      {fields.length === MAX_HINTS && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Maximum of {MAX_HINTS} hints reached.
        </p>
      )}
    </div>
  )
}

export function HuntForm({ hunt, onUpdate, onRemove, huntId, onCluesSaved, onImageUploadStateChange }: HuntFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingClues, setIsSavingClues] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [linkEnabled, setLinkEnabled] = useState(false)
  const [imageUploadState, setImageUploadState] = useState<CoverImageUploadState>("idle")
  // Track which clue rows have their hints section expanded
  const [expandedHints, setExpandedHints] = useState<Record<number, boolean>>({})

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CluesFormData>({
    resolver: zodResolver(cluesFormSchema),
    defaultValues: {
      clues: [{ ...DEFAULT_CLUE }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "clues",
  })

  const toggleHints = (index: number) => {
    setExpandedHints((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const updateImageUploadState = (state: CoverImageUploadState) => {
    setImageUploadState(state)
    onImageUploadStateChange?.(state)
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    updateImageUploadState("uploading")
    setIsUploading(true)

    try {
      const ipfsUri = await uploadToIPFS(file)
      onUpdate("image", ipfsUri)
      updateImageUploadState("succeeded")
    } catch (error) {
      logger.error("Error uploading image to IPFS:", error)
      updateImageUploadState("failed")
      toast.error(COVER_IMAGE_UPLOAD_ERROR_MESSAGE)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setIsUploading(false)
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
    append({ ...DEFAULT_CLUE })
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

        // Build the ClueHint array (only include hints with text)
        const hints: ClueHint[] = (row.hints ?? [])
          .filter((h) => h.text.trim().length > 0)
          .slice(0, MAX_HINTS)
          .map((h) => ({
            text: h.text.trim(),
            penalty: h.penalty,
            delaySeconds: h.delaySeconds,
          }))

        // Persist locally first to obtain a stable clue id for salting
        const newId = saveClueLocally({
          huntId,
          question: row.question.trim(),
          answer: normalizedAnswer,
          points: row.points,
          hints: hints.length > 0 ? hints : undefined,
          difficulty: row.difficulty,
        })

        const salt = `${huntId}_${newId}`
        const hashed = await sha256Hex(normalizedAnswer + salt)

        await withTransactionToast(
          async (setStage) => {
            setStage("approving")
            return addClue(
              huntId,
              row.question.trim(),
              hashed,
              row.points,
              hints,
              row.difficulty,
            )
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
          logger.warn("Failed to update local clue answer with hash", e)
        }
      }
      onCluesSaved?.(valid.length)
      reset({ clues: [{ ...DEFAULT_CLUE }] })
      setExpandedHints({})
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

        <div className="flex gap-1">
          <Input
            placeholder="Description"
            aria-label="Hunt Description"
            value={hunt.description}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate("description", e.target.value)}
            className="w-full pl-6 py-3"
          />
          <div className="relative">
            <Button
              type="button"
              size="icon"
              onClick={triggerFileInput}
              disabled={isUploading}
              aria-label="Upload hunt cover image"
              className="bg-gradient-to-b from-[#3737A4] to-[#0C0C4F] hover:bg-slate-700 rounded-[12px] text-white cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.02 3H16V0.98C16 0.44 15.56 0 15.02 0H14.99C14.44 0 14 0.44 14 0.98V3H11.99C11.45 3 11.01 3.44 11 3.98V4.01C11 4.56 11.44 5 11.99 5H14V7.01C14 7.55 14.44 8 14.99 7.99H15.02C15.56 7.99 16 7.55 16 7.01V5H18.02C18.56 5 19 4.56 19 4.02V3.98C19 3.44 18.56 3 18.02 3ZM13 7.01V6H11.99C11.46 6 10.96 5.79 10.58 5.42C10.21 5.04 10 4.54 10 3.98C10 3.62 10.1 3.29 10.27 3H2C0.9 3 0 3.9 0 5V17C0 18.1 0.9 19 2 19H14C15.1 19 16 18.1 16 17V8.72C15.7 8.89 15.36 9 14.98 9C13.89 8.99 13 8.1 13 7.01ZM12.96 17H3C2.59 17 2.35 16.53 2.6 16.2L4.58 13.57C4.79 13.29 5.2 13.31 5.4 13.59L7 16L9.61 12.52C9.81 12.26 10.2 12.25 10.4 12.51L13.35 16.19C13.61 16.52 13.38 17 12.96 17Z" fill="#FAFAFA"/>
                </svg>
              )}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              aria-label="Upload cover image"
              className="hidden"
            />
            {hunt.image && (
              <div className="absolute -right-2 -top-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full" />
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

                {/* ── Row 1: question / answer / points / delete ── */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500 w-4 shrink-0">{index + 1}.</span>
                  <div className="flex-1 flex flex-col">
                    <Controller
                      control={control}
                      name={`clues.${index}.question`}
                      render={({ field: f }) => (
                        <Input
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
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClueRow(index)}
                    disabled={fields.length === 1}
                    className="text-red-400 hover:text-red-600 shrink-0 disabled:opacity-30"
                    aria-label={`Remove clue ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* ── Row 2: difficulty + hints toggle ── */}
                <div className="flex gap-2 items-center pl-6">
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

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleHints(index)}
                    className="ml-auto text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 gap-1"
                    aria-expanded={!!expandedHints[index]}
                    aria-controls={`hints-panel-${index}`}
                  >
                    {expandedHints[index] ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    Hints
                  </Button>
                </div>

                {/* ── Hints panel (collapsible) ── */}
                {expandedHints[index] && (
                  <div id={`hints-panel-${index}`} className="pt-1">
                    <p className="pl-6 text-xs text-slate-500 dark:text-slate-400 mb-2">
                      Add up to {MAX_HINTS} progressive hints. Players must wait the specified delay before
                      revealing the next hint, and each hint deducts points from their score.
                    </p>
                    <ClueHintsEditor
                      clueIndex={index}
                      control={control}
                      errors={errors}
                    />
                  </div>
                )}
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
    </div>
  )
}
