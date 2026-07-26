/**
 * Central type definitions for the Hunty application.
 *
 * Platform-agnostic domain types (Hunt, Clue, Player, Reward, Achievement)
 * live in the shared `@hunty/types` package and are re-exported here so that
 * existing `@/lib/types` imports keep working. Web-only and React-coupled
 * types (display entries, performance, chat, …) remain defined below.
 */

import type { ReactNode } from "react"
import type { ClueScoringBreakdown, HuntScoringBreakdown, ScoringWeights } from "./scoring"
import type { ClueDifficulty, PlayerProgress, Reward as DomainReward } from "@hunty/types"

// ─── Shared domain types (single source of truth: @hunty/types) ──────────────

export type {
  HuntStatus,
  HuntCategory,
  HuntDifficulty,
  StoredHunt,
  HuntInfo,
  HuntDraft,
  ClueDifficulty,
  Clue,
  ClueInfo,
  ClueRow,
  PlayerProgress,
  PlayerStats,
  PlayerHuntProgress,
  HuntProgressStatus,
  RewardType,
  RewardReceiptType,
  RewardReceipt,
  RewardHistoryType,
  RewardHistoryEntry,
  Achievement,
  AchievementId,
  AchievementRarity,
} from "@hunty/types"

// ─── Transaction Results ─────────────────────────────────────────────────────

export type CreateHuntResult = {
  txHash: string
}

export type ClaimRewardResult = {
  txHash: string
  /** ipfs:// URI for the SEP-0039 compliant metadata JSON uploaded before minting. */
  metadataUri: string
}

export type SubmitAnswerResult = {
  txHash: string
  /** The contract event emitted on success. */
  event: "ClueCompleted"
}

export type ActivateHuntResult = {
  txHash: string
}

export type AddClueResult = {
  txHash: string
}

export type ExtendHuntResult = {
  txHash: string
  newEndTime: number
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export type LeaderboardTimePeriod = "today" | "week" | "month" | "all"
export type LeaderboardMetric = "points" | "completions"

export type LeaderboardEntry = {
  address: string
  name?: string
  points: number
  completionCount?: number
  completedAt?: number
  category?: string
  difficulty?: ClueDifficulty
}

export interface LeaderboardFilters {
  timePeriod: LeaderboardTimePeriod
  category: string
  difficulty: ClueDifficulty | "all"
  metric: LeaderboardMetric
}

export type FastestPlayerEntry = {
  address: string
  name?: string
  points?: number
  completionTimeSeconds: number
}

export interface LeaderboardDisplayEntry {
  position: number
  name: string
  points: number
  icon: ReactNode
  completionCount?: number
  completedAt?: number
  category?: string
  difficulty?: ClueDifficulty
}

export interface FastestPlayerDisplayEntry {
  position: number
  name: string
  completionTimeLabel: string
  points?: number
  icon: ReactNode
}

// ─── Registration (PlayerProgress lives in @hunty/types) ─────────────────────

export type RegistrationStatus = {
  isRegistered: boolean
  progressData?: PlayerProgress
  loading: boolean
  error?: string
}

export type RegistrationResult = {
  success: boolean
  error?: string
  transactionHash?: string
}

export type HuntAttemptStatus = "completed" | "abandoned" | "in_progress"

export interface ClueAttemptRecord {
  clueId: number
  clueIndex: number
  question: string
  answerGiven: string
  timeTakenSeconds: number
  pointsEarned: number
  answeredAt: string
  hintsUsed: number // Number of hints used for this clue
  scoringBreakdown?: ClueScoringBreakdown // Detailed scoring breakdown
}

export interface HuntAttemptRecord {
  id: string
  huntId: number
  huntTitle: string
  playerAddress: string
  status: HuntAttemptStatus
  startedAt: string
  completedAt?: string
  totalTimeSeconds: number
  totalPoints: number
  clues: ClueAttemptRecord[]
  attemptNumber: number
  currentStreak: number // Current consecutive clues solved streak
  scoringWeights?: ScoringWeights // Scoring weights used for this attempt
  scoringBreakdown?: HuntScoringBreakdown // Detailed scoring breakdown for the entire attempt
  isFirstToComplete?: boolean // Whether this was the first completion of the hunt
}

export interface HuntAttemptTimeComparison {
  playerTimeSeconds: number
  playerTimeLabel: string
  fastestTimeSeconds: number | null
  fastestTimeLabel: string | null
  averageTimeSeconds: number | null
  averageTimeLabel: string | null
  rankAmongFastest: number | null
  totalComparedPlayers: number
}

// ─── Reward (web view) ───────────────────────────────────────────────────────

/**
 * Web-facing reward bucket. Extends the shared domain {@link DomainReward}
 * with an optional rendered icon node used by the reward panels. The plain
 * `{ place, amount }` domain shape (and the receipt/history types) live in
 * `@hunty/types`.
 */
export interface Reward extends DomainReward {
  icon?: ReactNode
}

export interface RewardPlayerProgress {
  is_completed: boolean
  reward_claimed: boolean
  hunt_id?: number | string
  reward_amount?: number
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

export type ActivityEventType = "HuntCompleted" | "ClueCompleted" | "HuntSponsored"

export interface ActivityEvent {
  id: string
  /** Full Stellar G-address of the participant */
  address: string
  /** Optional display name resolved from the player's profile */
  displayName?: string
  huntTitle: string
  huntId: number
  timestamp: number
  type: ActivityEventType
  /** Amount for sponsored events */
  amount?: number
}

// ─── Component-level Hunt (used by PlayGame, HuntForm, GamePreview, HuntCards) ─

export interface HuntCard {
  id: number
  title?: string
  description?: string
  link?: string
  code?: string
  image?: string
  hint?: string
  hintCost?: number
  points?: number
  difficulty?: ClueDifficulty
}

// HuntDraft and PlayerStats now live in @hunty/types (re-exported above).

export type CoverImageUploadState = "idle" | "uploading" | "succeeded" | "failed"

// ─── Player Count ────────────────────────────────────────────────────────────

/**
 * Player count above which a hunt is considered "Trending".
 *
 * A hunt whose registered player count is >= this value receives the
 * 🔥 Trending badge on its card. Set to 50 as a reasonable signal of
 * meaningful engagement without being too easy to trigger on small hunts.
 *
 * To tune: lower the value to badge more hunts (e.g. 20 for a new platform
 * with low traffic); raise it to reserve the badge for genuinely popular hunts.
 */
export const TRENDING_PLAYER_THRESHOLD = 50

/**
 * How long a fetched player count is considered fresh (ms).
 *
 * After this TTL the next call to `usePlayerCount` / `usePlayerCounts` will
 * re-scan localStorage and update the cache. The cache is module-level, so it
 * resets on a full page reload — satisfying the "updates on each arcade page
 * load" requirement without stale counts surviving navigation.
 *
 * Tradeoff: shorter TTL → fresher counts but more localStorage scans per
 * session; longer TTL → fewer scans but counts may lag behind reality.
 * 60 s is a reasonable default for a game arcade where registration activity
 * is bursty rather than continuous.
 */
export const PLAYER_COUNT_CACHE_TTL_MS = 60_000

export interface PlayerCountResult {
  huntId: string
  count: number
  /**
   * `true` when `count >= TRENDING_PLAYER_THRESHOLD`.
   *
   * Computed at fetch time and cached alongside the count, so the badge
   * reflects the same snapshot as the displayed number. Re-evaluated on
   * every cache miss (stale or absent entry).
   */
  isTrending: boolean
  fetchedAt: number   // Date.now() at time of fetch
  isLoading: boolean
  error: string | null
}

// ─── Profile Dashboard Types ───────────────────────────────────────────────────
// HuntProgressStatus and PlayerHuntProgress now live in @hunty/types.

export interface NftAttribute {
  trait_type: string
  value: string | number
}

export interface NftRewardDetail {
  id: number
  name: string
  description?: string
  imageUri: string
  earnedAt: string
  claimed: boolean
  huntName?: string
  attributes?: NftAttribute[]
  /** ipfs:// URI pointing to the SEP-0039 metadata JSON file for this NFT. */
  metadataUri?: string
}

export interface ProfileSummary {
  totalHunts: number
  completedHunts: number
  inProgressHunts: number
  totalPoints: number
  completionRate: number
  totalNftRewards: number
  claimedNftRewards: number
  unclaimedNftRewards: number
}

// ─── Seasonal Leaderboard ───────────────────────────────────────────────────

export type SeasonStatus = "Upcoming" | "Active" | "Ended"

export interface Season {
  id: number
  name: string
  /** Unix timestamp in seconds — when the season starts. */
  startTime: number
  /** Unix timestamp in seconds — when the season ends. */
  endTime: number
  status: SeasonStatus
  /** Reward amounts for the top N players, indexed by place (1st, 2nd, ...). */
  rewards?: Reward[]
}

export interface SeasonLeaderboardEntry {
  address: string
  name?: string
  points: number
  /** Final rank for this player at season end (set once archived). */
  rank?: number
}

export interface ArchivedSeason {
  season: Season
  finalLeaderboard: SeasonLeaderboardEntry[]
  archivedAt: number
}

export interface SeasonBadge {
  seasonId: number
  seasonName: string
  /** Final rank the player achieved, if the season has ended. */
  rank?: number
  earnedAt: number
}

// ─── Core Web Vitals ────────────────────────────────────────────────────────────

export type WebVitalMetric = "LCP" | "FID" | "CLS" | "TTFB" | "INP" | "FCP"

export interface PerformanceMetric {
  name: WebVitalMetric
  value: number
  rating: "good" | "needs-improvement" | "poor"
  timestamp: number
  url: string
}

export interface PerformanceBudget {
  name: WebVitalMetric
  good: number
  poor: number
}

export interface PerformanceReportEntry {
  id: string
  metrics: PerformanceMetric[]
  timestamp: number
  url: string
  userAgent: string
}

export interface PerformanceAlert {
  metric: WebVitalMetric
  value: number
  threshold: number
  timestamp: number
  url: string
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  huntId: number
  senderAddress: string
  senderName?: string
  content: string
  timestamp: number
  isDeleted?: boolean
}

export interface ChatSettings {
  huntId: number
  isChatEnabled: boolean
  creatorAddress?: string
  mutedAddresses: string[]
}

export interface ReportedMessage {
  id: string
  messageId: string
  huntId: number
  reportedBy: string
  reason: string
  timestamp: number
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export interface WaitlistEntry {
  id: string
  huntId: number
  playerAddress: string
  playerName?: string
  timestamp: number
  isNotified?: boolean
}

export interface HuntRegistrationStatus {
  isRegistered: boolean
  isWaitlisted: boolean
  waitlistPosition?: number
  progressData?: PlayerProgress
  loading: boolean
  error?: string
}
