/**
 * Clue domain types shared across web and mobile.
 */

export type ClueDifficulty = "Easy" | "Medium" | "Hard"

/** A fully-specified clue as stored/served for a hunt. */
export interface Clue {
  id: number
  huntId: number
  question: string
  answer: string
  points: number
  hint?: string
  hintCost?: number
  /** Optional difficulty tag set by the creator. */
  difficulty?: ClueDifficulty
  /** Center latitude for the clue's answer geofence. */
  latitude?: number
  /** Center longitude for the clue's answer geofence. */
  longitude?: number
  /** Allowed distance from the clue center in metres. Defaults to 100m. */
  geofenceRadiusMeters?: number
}

/** Public projection of a clue (no answer) served to players. */
export interface ClueInfo {
  id: number
  question: string
  points: number
  hint?: string
  hintCost?: number
  difficulty?: ClueDifficulty
}

/** Creator-side clue row including the answer. */
export interface ClueRow {
  id: number
  question: string
  answer: string
  points: number
  hint?: string
  hintCost?: number
  difficulty?: ClueDifficulty
}
