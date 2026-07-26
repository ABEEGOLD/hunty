/**
 * Shared hunt list for dashboard (creator hunts) and Game Arcade (active hunts).
 * Persisted in localStorage so activated hunts appear in the arcade after refresh.
 */

import type { HuntStatus, StoredHunt, Clue } from "@/lib/types"
import { getHuntsWithRatings } from "@/lib/reviews"
import { applyHuntScheduleTransitions } from "@/lib/huntScheduling"
import { normalizeHuntStatus } from "@/lib/huntStatus"
import { migrateHuntScheduleFieldsInCollection } from "@/lib/huntScheduleMigration"

export type { HuntStatus, StoredHunt, Clue }

export type HuntStoreSnapshot = {
  hunts: StoredHunt[]
  clues: Clue[]
}

export interface HuntProgressSnapshot {
  huntId: number
  currentClueIndex: number
  startedAt: number
  completed: boolean
  completedAt?: number
}

export interface HuntStorageGcResult {
  huntId: number
  reclaimedBytes: number
  removedKeys: string[]
}

const STORAGE_KEY = "hunty_hunts"
const CLUES_KEY = "hunty_clues"
const HUNT_PROGRESS_KEY_PREFIX = "hunty_hunt_progress_"

export const MAX_CLUES_PER_HUNT = 10

// Seed timestamps: active hunts end 7 days from first load, completed hunts in the past.
const NOW_SECONDS = Math.floor(Date.now() / 1000)

export const SEED_HUNTS: StoredHunt[] = [
  {
    id: 1,
    title: "City Secrets",
    description: "Race across town to uncover hidden murals and landmarks.",
    cluesCount: 5,
    category: "Urban",
    difficulty: "Medium",
    status: "Active",
    rewardType: "XLM",
    rewardPool: 150,
    poolBalance: 150,
    rewardDistribution: [
      { place: 1, amount: 100 },
      { place: 2, amount: 30 },
      { place: 3, amount: 20 },
    ],
    playerCount: 32,
    createdAt: NOW_SECONDS - 2 * 86400,
    startTime: NOW_SECONDS - 86400,
    endTime: NOW_SECONDS + 7 * 86400,
    difficulty: "Easy",
  },
  {
    id: 2,
    title: "Campus Quest",
    description: "Solve riddles scattered around campus before the timer ends.",
    cluesCount: 7,
    category: "Campus",
    difficulty: "Hard",
    status: "Active",
    rewardType: "NFT",
    rewardPool: 40,
    poolBalance: 40,
    rewardDistribution: [],
    playerCount: 21,
    createdAt: NOW_SECONDS - 4 * 86400,
    startTime: NOW_SECONDS - 2 * 86400,
    endTime: NOW_SECONDS + 3 * 86400,
    difficulty: "Hard",
  },
  {
    id: 3,
    title: "Office Onboarding Hunt",
    description: "A playful intro game for new teammates around the office.",
    cluesCount: 4,
    category: "Office",
    difficulty: "Easy",
    status: "Completed",
    rewardType: "Both",
    rewardPool: 250,
    poolBalance: 0,
    rewardDistribution: [],
    playerCount: 14,
    createdAt: NOW_SECONDS - 12 * 86400,
    startTime: NOW_SECONDS - 10 * 86400,
    endTime: NOW_SECONDS - 5 * 86400,
    difficulty: "Expert",
  },
  {
    id: 4,
    title: "Summer Treasure Hunt",
    description: "Find hidden clues in the park.",
    cluesCount: 3,
    category: "General",
    difficulty: "Easy",
    status: "Draft",
    rewardType: "XLM",
    rewardPool: 80,
    poolBalance: 80,
    rewardDistribution: [],
    playerCount: 0,
    createdAt: NOW_SECONDS - 3 * 86400,
  },
  {
    id: 5,
    title: "Museum Mystery",
    description: "Discover art and history through clues.",
    cluesCount: 0,
    category: "Museum",
    difficulty: "Medium",
    status: "Draft",
    rewardType: "NFT",
    rewardPool: 25,
    poolBalance: 25,
    rewardDistribution: [],
    playerCount: 0,
    createdAt: NOW_SECONDS - 86400,
  },
]

function readClues(): Clue[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CLUES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Clue[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeClues(clues: Clue[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CLUES_KEY, JSON.stringify(clues))
  } catch {
    // ignore
  }
}

function readHunts(): StoredHunt[] {
  if (typeof window === "undefined") return [...SEED_HUNTS]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...SEED_HUNTS]
    const parsed = JSON.parse(raw) as StoredHunt[]
    return Array.isArray(parsed) ? migrateHuntScheduleFieldsInCollection(parsed) : migrateHuntScheduleFieldsInCollection([...SEED_HUNTS])
  } catch {
    return [...SEED_HUNTS]
  }
}

function writeHunts(hunts: StoredHunt[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hunts))
  } catch {
    // ignore
  }
}

function getProgressKey(huntId: number): string {
  return `${HUNT_PROGRESS_KEY_PREFIX}${huntId}`
}

function readProgressEntry(huntId: number): HuntProgressSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(getProgressKey(huntId))
    return raw ? (JSON.parse(raw) as HuntProgressSnapshot) : null
  } catch {
    return null
  }
}

function writeProgressEntry(progress: HuntProgressSnapshot): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(getProgressKey(progress.huntId), JSON.stringify(progress))
  } catch {
    // ignore
  }
}

function measureStorageEntrySize(key: string, value: string): number {
  return new TextEncoder().encode(`${key}:${value}`).length
}

function removeStorageKeysByPrefix(prefix: string): { reclaimedBytes: number; removedKeys: string[] } {
  if (typeof window === "undefined") {
    return { reclaimedBytes: 0, removedKeys: [] }
  }

  const removedKeys: string[] = []
  let reclaimedBytes = 0

  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      keys.push(key)
    }
  }

  for (const key of keys) {
    const value = localStorage.getItem(key) ?? ""
    reclaimedBytes += measureStorageEntrySize(key, value)
    localStorage.removeItem(key)
    removedKeys.push(key)
  }

  return { reclaimedBytes, removedKeys }
}

function validateClueDraft(clue: Omit<Clue, "id">, index: number): Omit<Clue, "id"> {
  const question = clue.question.trim()
  const answer = clue.answer.trim()

  if (!question) {
    throw new Error(`Clue ${index + 1} question is required.`)
  }
  if (!answer) {
    throw new Error(`Clue ${index + 1} answer is required.`)
  }
  if (!Number.isFinite(clue.points) || clue.points <= 0) {
    throw new Error(`Clue ${index + 1} points must be greater than 0.`)
  }

  return {
    ...clue,
    question,
    answer,
    hint: clue.hint?.trim() || undefined,
  }
}

function getExistingClueCount(huntId: number): number {
  return getHuntClues(huntId).length
}

/** All hunts (for Game Arcade: filter by status === "Active"). Private, archived, and soft-deleted hunts are excluded. */
export function getAllHunts(): StoredHunt[] {
  return getHuntsWithRatings(readHunts().filter((h) => !h.is_private))
  return readHunts().filter((h) => !h.is_private && !h.isArchived && !h.deletedAt)
  return applyHuntScheduleTransitions(readHunts()).filter((h) => !h.is_private)
}

/** All hunts including private ones (for creator dashboard). */
export function getAllHuntsIncludingPrivate(): StoredHunt[] {
  return applyHuntScheduleTransitions(readHunts())
}

/** Creator hunts for dashboard (all stored hunts including private; excludes soft-deleted). */
export function getCreatorHunts(): StoredHunt[] {
  return readHunts().filter((h) => !h.deletedAt)
  return applyHuntScheduleTransitions(readHunts())
}

/** Get hunts for a creator (creator public-key filter not implemented yet; returns all hunts). */
export function getHuntsByCreator(creator?: string): StoredHunt[] {
  const hunts = applyHuntScheduleTransitions(readHunts())
  if (!creator) return hunts
  return hunts.filter((hunt) => {
    const withCreator = hunt as StoredHunt & { creator?: string }
    return !withCreator.creator || withCreator.creator === creator
  })
}

/** Update a hunt's status (e.g. Draft → Active after activate_hunt). */
export function updateHuntStatus(huntId: number, status: HuntStatus): void {
  const hunts = readHunts().map((h) => (h.id === huntId ? { ...h, status } : h))
  writeHunts(hunts)
}

/** Update a hunt's end time (e.g. after extend_end_time). */
export function updateHuntEndTime(huntId: number, newEndTime: number): void {
  const hunts = readHunts().map((h) => (h.id === huntId ? { ...h, endTime: newEndTime } : h))
  writeHunts(hunts)
}

/** Update reward escrow metadata after deposits, payouts, or refunds. */
export function updateHuntRewardEscrow(
  huntId: number,
  rewardEscrowBalance: number,
  rewardEscrowTxHash?: string
): void {
  const hunts = readHunts().map((h) =>
    h.id === huntId
      ? {
          ...h,
          rewardEscrowBalance,
          ...(rewardEscrowTxHash ? { rewardEscrowTxHash } : {}),
        }
      : h
  )
  writeHunts(hunts)
}

/** Delete multiple hunts by IDs. */
export function deleteHunts(ids: number[]): void {
  const hunts = readHunts().filter((h) => !ids.includes(h.id))
  writeHunts(hunts)
  
  // Also clean up clues for these hunts
  const allClues = readClues()
  const remainingClues = allClues.filter((c) => !ids.includes(c.huntId))
  writeClues(remainingClues)
}

/** Archive (Cancel) multiple hunts by IDs. */
export function archiveHunts(ids: number[]): void {
  const hunts = readHunts().map((h) =>
    ids.includes(h.id) ? { ...h, status: "Cancelled" as HuntStatus } : h
  )
  writeHunts(hunts)
  ids.forEach((huntId) => {
    gcHunt(huntId)
  })
}

/** Hide hunts from public view (data preserved) — used by creator archive/unarchive flow. */
export function hideHuntsFromPublic(ids: number[]): void {
  const hunts = readHunts().map((h) =>
    ids.includes(h.id) ? { ...h, isArchived: true } : h
  )
  writeHunts(hunts)
}

/** Restore hidden hunts to public view. */
export function unhideHuntsFromPublic(ids: number[]): void {
  const hunts = readHunts().map((h) =>
    ids.includes(h.id) ? { ...h, isArchived: false } : h
  )
  writeHunts(hunts)
}

/** Soft delete multiple hunts by IDs with 30-day recovery window. */
export function softDeleteHunts(ids: number[]): void {
  const now = Math.floor(Date.now() / 1000)
  const recoveryWindow = 30 * 86400 // 30 days in seconds
  const hunts = readHunts().map((h) =>
    ids.includes(h.id) ? { ...h, deletedAt: now, recoveryWindow } : h
  )
  writeHunts(hunts)
}

/** Restore soft-deleted hunts by IDs. */
export function restoreHunts(ids: number[]): void {
  const hunts = readHunts().map((h) =>
    ids.includes(h.id) ? { ...h, deletedAt: undefined, recoveryWindow: undefined } : h
  )
  writeHunts(hunts)
}

/** Permanently delete hunts (irreversible). */
export function permanentDeleteHunts(ids: number[]): void {
  const hunts = readHunts().filter((h) => !ids.includes(h.id))
  writeHunts(hunts)

  // Also clean up clues for these hunts
  const allClues = readClues()
  const remainingClues = allClues.filter((c) => !ids.includes(c.huntId))
  writeClues(remainingClues)
}

/** Get archived hunts. */
export function getArchivedHunts(): StoredHunt[] {
  return readHunts().filter((h) => h.isArchived)
}

/** Get soft-deleted hunts that are still within recovery window. */
export function getSoftDeletedHunts(): StoredHunt[] {
  const now = Math.floor(Date.now() / 1000)
  return readHunts().filter((h) => {
    if (!h.deletedAt) return false
    const recoveryDeadline = h.deletedAt + (h.recoveryWindow || 30 * 86400)
    return now < recoveryDeadline
  })
}

/** Get hunts that are past recovery window (eligible for cleanup). */
export function getExpiredSoftDeletedHunts(): StoredHunt[] {
  const now = Math.floor(Date.now() / 1000)
  return readHunts().filter((h) => {
    if (!h.deletedAt) return false
    const recoveryDeadline = h.deletedAt + (h.recoveryWindow || 30 * 86400)
    return now >= recoveryDeadline
  })
}

/** Get a single hunt by ID */
export function getHuntById(id: number): StoredHunt | undefined {
  const hunt = readHunts().find((h) => h.id === id)
  if (!hunt) return undefined
  return getHuntsWithRatings([hunt])[0]
  return applyHuntScheduleTransitions(readHunts()).find((h) => h.id === id)
}

/** Get reward-pool related data for a hunt. */
export function getHuntPool(huntId: number) {
  const hunt = getHuntById(huntId)
  if (!hunt) return null
  return {
    rewardPool: hunt.rewardPool ?? 0,
    poolBalance: hunt.poolBalance ?? hunt.rewardPool ?? 0,
    distribution: hunt.rewardDistribution ?? [],
    lowThreshold: hunt.poolLowBalanceThreshold ?? Math.max(1, (hunt.rewardPool ?? 0) * 0.2),
  }
}

/** Deposit XLM into a hunt's reward pool. Updates both `rewardPool` and `poolBalance`. */
export function depositToPool(huntId: number, amount: number): boolean {
  if (amount <= 0) return false
  const hunts = readHunts().map((h) => {
    if (h.id !== huntId) return h
    const prevTotal = h.rewardPool ?? 0
    const prevBalance = h.poolBalance ?? prevTotal
    return { ...h, rewardPool: prevTotal + amount, poolBalance: prevBalance + amount }
  })
  writeHunts(hunts)
  return true
}

/** Alias for deposit. */
export function topUpPool(huntId: number, amount: number): boolean {
  return depositToPool(huntId, amount)
}

/** Withdraw unclaimed rewards after a hunt ends or is not active anymore. */
export function withdrawUnclaimedRewards(huntId: number, amount: number): boolean {
  const hunt = getHuntById(huntId)
  if (!hunt) return false
  if (hunt.status === "Active") return false
  const prevBalance = hunt.poolBalance ?? hunt.rewardPool ?? 0
  const withdrawAmount = Math.min(amount, prevBalance)
  const hunts = readHunts().map((h) =>
    h.id === huntId ? { ...h, poolBalance: prevBalance - withdrawAmount, rewardPool: Math.max(0, (h.rewardPool ?? 0) - withdrawAmount) } : h
  )
  writeHunts(hunts)
  return true
}

/** Set a distribution plan for a hunt's reward pool. */
export function setDistributionPlan(huntId: number, distribution: { place: number; amount: number }[]) {
  const hunts = readHunts().map((h) =>
    h.id === huntId ? { ...h, rewardDistribution: distribution, rewardPool: distribution.reduce((s, d) => s + d.amount, 0), poolBalance: distribution.reduce((s, d) => s + d.amount, 0) } : h
  )
  writeHunts(hunts)
}

/** Returns whether the pool is considered low based on configured threshold. */
export function isPoolLow(huntId: number): boolean {
  const hunt = getHuntById(huntId)
  if (!hunt) return false
  const balance = hunt.poolBalance ?? hunt.rewardPool ?? 0
  const threshold = hunt.poolLowBalanceThreshold ?? Math.max(1, (hunt.rewardPool ?? 0) * 0.2)
  return balance < threshold
}

/** Add a new hunt (e.g. after createHunt). */
export function addHunt(hunt: StoredHunt): void {
  const hunts = readHunts()
  if (hunts.some((h) => h.id === hunt.id)) return
  const normalized = {
    ...hunt,
    status: normalizeHuntStatus(hunt.status) as StoredHunt["status"],
  }
  writeHunts([...hunts, normalized])
}

/** Get all clues for a specific hunt. */
export function getHuntClues(huntId: number): Clue[] {
  return readClues().filter((c) => c.huntId === huntId)
}

/** Persist a new clue locally and increment the hunt's cluesCount. */
export function saveClueLocally(clue: Omit<Clue, "id">): number {
  const ids = saveCluesLocallyBatch([clue])
  return ids[0]
}

/** Persist multiple new clues locally in one write. */
export function saveCluesLocallyBatch(clues: Omit<Clue, "id">[]): number[] {
  if (clues.length === 0) {
    return []
  }

  const normalized = clues.map((clue, index) => validateClueDraft(clue, index))
  const huntId = normalized[0]?.huntId
  if (normalized.some((clue) => clue.huntId !== huntId)) {
    throw new Error("All clues in a batch must belong to the same hunt.")
  }

  if (getExistingClueCount(huntId) + normalized.length > MAX_CLUES_PER_HUNT) {
    throw new Error(`A hunt can have at most ${MAX_CLUES_PER_HUNT} clues.`)
  }

  const all = readClues()
  const nextId = all.length > 0 ? Math.max(...all.map((c) => c.id)) + 1 : 1
  const withIds = normalized.map((clue, index) => ({
    ...clue,
    id: nextId + index,
  }))

  writeClues([...all, ...withIds])

  const hunts = readHunts().map((hunt) =>
    hunt.id === huntId ? { ...hunt, cluesCount: hunt.cluesCount + withIds.length } : hunt
  )
  writeHunts(hunts)

  return withIds.map((clue) => clue.id)
}

/** Update an existing clue's answer or other fields. Returns true if updated. */
export function updateClueAnswer(huntId: number, clueId: number, answer: string): boolean {
  const all = readClues()
  const idx = all.findIndex((c) => c.huntId === huntId && c.id === clueId)
  if (idx === -1) return false
  const updated = [...all]
  updated[idx] = { ...updated[idx], answer }
  writeClues(updated)
  return true
}

/** Reads the current per-hunt progress snapshot. */
export function getHuntProgress(huntId: number): HuntProgressSnapshot {
  const existing = readProgressEntry(huntId)
  if (existing) {
    return existing
  }

  const initial: HuntProgressSnapshot = {
    huntId,
    currentClueIndex: 0,
    startedAt: Date.now(),
    completed: false,
  }
  writeProgressEntry(initial)
  return initial
}

/** Records that a hunt has started for the current browser session. */
export function startHuntProgress(huntId: number): HuntProgressSnapshot {
  const current = getHuntProgress(huntId)
  const next: HuntProgressSnapshot = {
    ...current,
    startedAt: current.startedAt || Date.now(),
  }
  writeProgressEntry(next)
  return next
}

/** Advances the tracked progress to the next clue index. */
export function advanceHuntProgress(
  huntId: number,
  nextClueIndex: number,
  totalClues: number,
): HuntProgressSnapshot {
  const current = getHuntProgress(huntId)
  const completed = nextClueIndex >= totalClues
  const next: HuntProgressSnapshot = {
    ...current,
    currentClueIndex: Math.max(current.currentClueIndex, nextClueIndex),
    completed,
    completedAt: completed ? Date.now() : current.completedAt,
  }
  writeProgressEntry(next)
  return next
}

/** Clears the tracked hunt progress for the current browser session. */
export function clearHuntProgress(huntId: number): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(getProgressKey(huntId))
}

/**
 * Garbage-collects hunt-scoped storage after a hunt is cancelled/archived.
 * Returns the number of bytes reclaimed and the keys removed.
 */
export function gcHunt(huntId: number): HuntStorageGcResult {
  if (typeof window === "undefined") {
    return { huntId, reclaimedBytes: 0, removedKeys: [] }
  }

  const hunt = getHuntById(huntId)
  if (!hunt || hunt.status !== "Cancelled") {
    return { huntId, reclaimedBytes: 0, removedKeys: [] }
  }

  const removedKeys: string[] = []
  let reclaimedBytes = 0

  const prefixes = [
    `hunt_clue_start_${huntId}_`,
    `hunt_clue_solved_${huntId}_`,
    `hunt_reward_receipt_${huntId}_`,
    `hunt_registered_${huntId}_`,
    `hunty_hunt_progress_${huntId}`,
    `hunt_${huntId}_my_points`,
    `hunt_completed_${huntId}`,
    `hunt_reward_claimed_${huntId}`,
    `hunt_started_${huntId}`,
    `hunt_completion_time_${huntId}`,
    `hunt_completers_${huntId}`,
    `hunt_stats_${huntId}_`,
  ]

  for (const prefix of prefixes) {
    const { reclaimedBytes: prefixBytes, removedKeys: prefixKeys } = removeStorageKeysByPrefix(prefix)
    reclaimedBytes += prefixBytes
    removedKeys.push(...prefixKeys)
  }

  clearHuntProgress(huntId)

  return { huntId, reclaimedBytes, removedKeys }
}

/** Snapshot current hunts/clues for optimistic UI rollback. */
export function takeHuntStoreSnapshot(): HuntStoreSnapshot {
  return {
    hunts: readHunts(),
    clues: readClues(),
  }
}

/** Restore hunts/clues after an optimistic update fails. */
export function restoreHuntStoreSnapshot(snapshot: HuntStoreSnapshot): void {
  writeHunts(snapshot.hunts)
  writeClues(snapshot.clues)
}

/** Get a single hunt by string ID */
export const getHunt = (id: string) => {
  return readHunts().find((c) => c.id === Number(id))
}

/**
 * Return up to `limit` featured hunts, ranked by a trending score.
 * Score factors: clue count, reward type variety, time remaining, recency.
 */
export function getFeaturedHunts(limit = 3): StoredHunt[] {
  const now = Math.floor(Date.now() / 1000)
  const active = readHunts().filter((h) => h.status === "Active" && !h.is_private)

  const scored = active.map((hunt) => {
    let score = 0
    // More clues = higher quality hunt
    score += hunt.cluesCount * 10
    // Dual-reward hunts are more attractive
    if (hunt.rewardType === "Both") score += 20
    else if (hunt.rewardType === "NFT") score += 10
    // Hunts ending soon get a boost (urgency)
    if (hunt.endTime) {
      const hoursLeft = (hunt.endTime - now) / 3600
      if (hoursLeft > 0 && hoursLeft < 48) score += 15
    }
    // Recently started hunts get a freshness boost
    if (hunt.startTime) {
      const daysSinceStart = (now - hunt.startTime) / 86400
      if (daysSinceStart < 3) score += 10
    }
    return { hunt, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hunt)
}

/** Duplicate a hunt, returning the new hunt or undefined if original not found. */
export function duplicateHunt(huntId: number): StoredHunt | undefined {
  const original = getHuntById(huntId)
  if (!original) return undefined

  const hunts = readHunts()
  const newId = hunts.length > 0 ? Math.max(...hunts.map((h) => h.id)) + 1 : 1
  const nowSeconds = Math.floor(Date.now() / 1000)

  const duplicate: StoredHunt = {
    id: newId,
    title: `Copy of ${original.title}`,
    description: original.description,
    cluesCount: 0,
    status: "Draft",
    rewardType: original.rewardType,
    rewardPool: undefined,
    rewards: undefined,
    rewardEscrowTxHash: undefined,
    rewardEscrowBalance: undefined,
    playerCount: 0,
    maxCapacity: original.maxCapacity,
    createdAt: nowSeconds,
    startTime: undefined,
    endTime: undefined,
    creatorEmail: original.creatorEmail,
    emailNotifications: original.emailNotifications,
    is_private: original.is_private,
    coverImageCid: original.coverImageCid,
    isFeaturedOfWeek: false,
  }

  addHunt(duplicate)

  const originalClues = getHuntClues(huntId)
  for (const clue of originalClues) {
    saveClueLocally({
      huntId: newId,
      question: clue.question,
      answer: clue.answer,
      points: clue.points,
      hint: clue.hint,
      hintCost: clue.hintCost,
      difficulty: clue.difficulty,
      latitude: clue.latitude,
      longitude: clue.longitude,
      geofenceRadiusMeters: clue.geofenceRadiusMeters,
    })
  }

  return duplicate
}

/** Set/unset a hunt as the featured Hunt of the Week in local storage. */
export function setLocalFeaturedHunt(huntId: number | null): void {
  const hunts = readHunts().map((h) => ({
    ...h,
    isFeaturedOfWeek: h.id === huntId ? true : false,
  }))
  writeHunts(hunts)
}
