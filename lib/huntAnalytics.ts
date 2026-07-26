/**
 * Hunt Analytics — types and server-side service.
 *
 * The data store is a flat JSON file at data/hunt-analytics.json.
 * Each entry keyed by huntId records views, starts, completions, per-clue
 * events, time-series daily buckets, and (opt-in) player demographics.
 *
 * This module is intentionally framework-agnostic so it can be imported by
 * Next.js API route handlers as well as unit tests.
 */

import { promises as fs } from "fs"
import path from "path"
import { logger } from "@/lib/logger"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClueDropOffEntry {
  /** 0-indexed clue position within the hunt. */
  clueIndex: number
  /** Human-readable label used in charts. */
  label: string
  /** Number of players who attempted this clue. */
  attempts: number
  /** Number of players who solved this clue. */
  completions: number
  /** Total time spent on this clue (sum across all players, in seconds). */
  totalTimeSeconds: number
}

export interface DemographicsEntry {
  /** Coarse device category derived from User-Agent. */
  deviceType: "mobile" | "desktop" | "tablet" | "unknown"
  count: number
}

export interface TimeSeriesPoint {
  /** ISO date string YYYY-MM-DD. */
  date: string
  views: number
  starts: number
  completions: number
}

export interface HuntAnalyticsRecord {
  huntId: number
  views: number
  starts: number
  completions: number
  /** Sum of total completion time across all finished attempts (seconds). */
  totalCompletionTimeSeconds: number
  clueDropOff: ClueDropOffEntry[]
  demographics: DemographicsEntry[]
  timeSeries: TimeSeriesPoint[]
  /** ISO string of last update. */
  updatedAt: string
}

/** Shape returned by the /api/analytics/[huntId] GET endpoint. */
export interface HuntAnalyticsResponse extends HuntAnalyticsRecord {
  completionRate: number
  avgCompletionTimeSeconds: number | null
}

// ─── Event payloads accepted by the POST endpoint ─────────────────────────────

export type AnalyticsEventType = "view" | "start" | "completion" | "clue_attempt" | "clue_completion"

export interface BaseAnalyticsEvent {
  type: AnalyticsEventType
  huntId: number
  /** ISO timestamp — defaults to server time when omitted. */
  timestamp?: string
}

export interface ViewEvent extends BaseAnalyticsEvent {
  type: "view"
  /** Coarse device type. */
  deviceType?: DemographicsEntry["deviceType"]
}

export interface StartEvent extends BaseAnalyticsEvent {
  type: "start"
}

export interface CompletionEvent extends BaseAnalyticsEvent {
  type: "completion"
  /** Total time in seconds for the full hunt. */
  totalTimeSeconds: number
}

export interface ClueAttemptEvent extends BaseAnalyticsEvent {
  type: "clue_attempt"
  clueIndex: number
  clueLabel?: string
}

export interface ClueCompletionEvent extends BaseAnalyticsEvent {
  type: "clue_completion"
  clueIndex: number
  clueLabel?: string
  timeTakenSeconds: number
}

export type AnalyticsEvent =
  | ViewEvent
  | StartEvent
  | CompletionEvent
  | ClueAttemptEvent
  | ClueCompletionEvent

// ─── Store helpers ────────────────────────────────────────────────────────────

const ANALYTICS_PATH = path.join(process.cwd(), "data", "hunt-analytics.json")

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(ANALYTICS_PATH), { recursive: true })
  try {
    await fs.access(ANALYTICS_PATH)
  } catch {
    await fs.writeFile(ANALYTICS_PATH, JSON.stringify({}, null, 2), "utf8")
  }
}

async function readStore(): Promise<Record<string, HuntAnalyticsRecord>> {
  await ensureFile()
  try {
    const raw = await fs.readFile(ANALYTICS_PATH, "utf8")
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, HuntAnalyticsRecord>)
      : {}
  } catch {
    return {}
  }
}

async function writeStore(data: Record<string, HuntAnalyticsRecord>): Promise<void> {
  await ensureFile()
  await fs.writeFile(ANALYTICS_PATH, JSON.stringify(data, null, 2), "utf8")
}

function emptyRecord(huntId: number): HuntAnalyticsRecord {
  return {
    huntId,
    views: 0,
    starts: 0,
    completions: 0,
    totalCompletionTimeSeconds: 0,
    clueDropOff: [],
    demographics: [],
    timeSeries: [],
    updatedAt: new Date().toISOString(),
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function upsertTimeSeries(
  series: TimeSeriesPoint[],
  field: keyof Omit<TimeSeriesPoint, "date">,
  date: string = todayISO()
): TimeSeriesPoint[] {
  const idx = series.findIndex((p) => p.date === date)
  if (idx === -1) {
    const point: TimeSeriesPoint = { date, views: 0, starts: 0, completions: 0 }
    point[field] += 1
    return [...series, point].sort((a, b) => a.date.localeCompare(b.date))
  }
  return series.map((p, i) => (i === idx ? { ...p, [field]: p[field] + 1 } : p))
}

function upsertDemographic(
  demographics: DemographicsEntry[],
  deviceType: DemographicsEntry["deviceType"]
): DemographicsEntry[] {
  const idx = demographics.findIndex((d) => d.deviceType === deviceType)
  if (idx === -1) return [...demographics, { deviceType, count: 1 }]
  return demographics.map((d, i) => (i === idx ? { ...d, count: d.count + 1 } : d))
}

function upsertClueAttempt(
  clues: ClueDropOffEntry[],
  clueIndex: number,
  clueLabel?: string
): ClueDropOffEntry[] {
  const idx = clues.findIndex((c) => c.clueIndex === clueIndex)
  const label = clueLabel ?? `Clue ${clueIndex + 1}`
  if (idx === -1) {
    return [
      ...clues,
      { clueIndex, label, attempts: 1, completions: 0, totalTimeSeconds: 0 },
    ].sort((a, b) => a.clueIndex - b.clueIndex)
  }
  return clues.map((c, i) =>
    i === idx ? { ...c, attempts: c.attempts + 1 } : c
  )
}

function upsertClueCompletion(
  clues: ClueDropOffEntry[],
  clueIndex: number,
  timeTakenSeconds: number,
  clueLabel?: string
): ClueDropOffEntry[] {
  const idx = clues.findIndex((c) => c.clueIndex === clueIndex)
  const label = clueLabel ?? `Clue ${clueIndex + 1}`
  if (idx === -1) {
    return [
      ...clues,
      {
        clueIndex,
        label,
        attempts: 1,
        completions: 1,
        totalTimeSeconds: timeTakenSeconds,
      },
    ].sort((a, b) => a.clueIndex - b.clueIndex)
  }
  return clues.map((c, i) =>
    i === idx
      ? {
          ...c,
          completions: c.completions + 1,
          totalTimeSeconds: c.totalTimeSeconds + timeTakenSeconds,
        }
      : c
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a single analytics event for a hunt.
 * This is the only write path — all event types funnel through here.
 */
export async function recordAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  const store = await readStore()
  const key = String(event.huntId)
  const rec: HuntAnalyticsRecord = store[key] ?? emptyRecord(event.huntId)
  const date = event.timestamp ? event.timestamp.slice(0, 10) : todayISO()

  switch (event.type) {
    case "view": {
      rec.views += 1
      rec.timeSeries = upsertTimeSeries(rec.timeSeries, "views", date)
      if (event.deviceType) {
        rec.demographics = upsertDemographic(rec.demographics, event.deviceType)
      }
      break
    }
    case "start": {
      rec.starts += 1
      rec.timeSeries = upsertTimeSeries(rec.timeSeries, "starts", date)
      break
    }
    case "completion": {
      rec.completions += 1
      rec.totalCompletionTimeSeconds += event.totalTimeSeconds
      rec.timeSeries = upsertTimeSeries(rec.timeSeries, "completions", date)
      break
    }
    case "clue_attempt": {
      rec.clueDropOff = upsertClueAttempt(rec.clueDropOff, event.clueIndex, event.clueLabel)
      break
    }
    case "clue_completion": {
      rec.clueDropOff = upsertClueCompletion(
        rec.clueDropOff,
        event.clueIndex,
        event.timeTakenSeconds,
        event.clueLabel
      )
      break
    }
  }

  rec.updatedAt = new Date().toISOString()
  store[key] = rec

  try {
    await writeStore(store)
  } catch (err) {
    logger.warn("huntAnalytics: failed to persist analytics event", err)
  }
}

/**
 * Return the full analytics record for one hunt, enriched with derived metrics.
 */
export async function getHuntAnalytics(huntId: number): Promise<HuntAnalyticsResponse> {
  const store = await readStore()
  const rec: HuntAnalyticsRecord = store[String(huntId)] ?? emptyRecord(huntId)

  const completionRate =
    rec.starts > 0 ? Math.round((rec.completions / rec.starts) * 100) : 0

  const avgCompletionTimeSeconds =
    rec.completions > 0
      ? Math.round(rec.totalCompletionTimeSeconds / rec.completions)
      : null

  return {
    ...rec,
    completionRate,
    avgCompletionTimeSeconds,
  }
}

/**
 * Return analytics for all hunts that have recorded data.
 */
export async function getAllHuntAnalytics(): Promise<HuntAnalyticsResponse[]> {
  const store = await readStore()
  return Object.values(store).map((rec) => {
    const completionRate =
      rec.starts > 0 ? Math.round((rec.completions / rec.starts) * 100) : 0
    const avgCompletionTimeSeconds =
      rec.completions > 0
        ? Math.round(rec.totalCompletionTimeSeconds / rec.completions)
        : null
    return { ...rec, completionRate, avgCompletionTimeSeconds }
  })
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function csvEscape(value: string | number): string {
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generate a CSV string summarising the analytics for a single hunt.
 * Returns the raw CSV text — callers are responsible for setting response headers.
 */
export function buildAnalyticsCsv(analytics: HuntAnalyticsResponse): string {
  const lines: string[] = []

  // Summary section
  lines.push("# Summary")
  lines.push("Metric,Value")
  lines.push(`Hunt ID,${csvEscape(analytics.huntId)}`)
  lines.push(`Views,${csvEscape(analytics.views)}`)
  lines.push(`Starts,${csvEscape(analytics.starts)}`)
  lines.push(`Completions,${csvEscape(analytics.completions)}`)
  lines.push(`Completion Rate (%),${csvEscape(analytics.completionRate)}`)
  lines.push(
    `Avg Completion Time (s),${csvEscape(analytics.avgCompletionTimeSeconds ?? "N/A")}`
  )
  lines.push("")

  // Time-series section
  lines.push("# Daily Activity")
  lines.push("Date,Views,Starts,Completions")
  for (const point of analytics.timeSeries) {
    lines.push(
      [
        csvEscape(point.date),
        csvEscape(point.views),
        csvEscape(point.starts),
        csvEscape(point.completions),
      ].join(",")
    )
  }
  lines.push("")

  // Clue drop-off section
  lines.push("# Clue Drop-off")
  lines.push("Clue,Attempts,Completions,Drop-off Rate (%),Avg Time (s)")
  for (const clue of analytics.clueDropOff) {
    const dropOffRate =
      clue.attempts > 0
        ? Math.round(((clue.attempts - clue.completions) / clue.attempts) * 100)
        : 0
    const avgTime =
      clue.completions > 0
        ? Math.round(clue.totalTimeSeconds / clue.completions)
        : "N/A"
    lines.push(
      [
        csvEscape(clue.label),
        csvEscape(clue.attempts),
        csvEscape(clue.completions),
        csvEscape(dropOffRate),
        csvEscape(avgTime),
      ].join(",")
    )
  }
  lines.push("")

  // Demographics section
  lines.push("# Player Demographics")
  lines.push("Device Type,Count")
  for (const demo of analytics.demographics) {
    lines.push([csvEscape(demo.deviceType), csvEscape(demo.count)].join(","))
  }

  return lines.join("\n")
}
