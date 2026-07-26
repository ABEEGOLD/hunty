import { describe, expect, it } from "vitest"

import {
  achievementSchema,
  clueSchema,
  playerProgressSchema,
  rewardSchema,
  schemas,
  storedHuntSchema,
} from "../src/schemas"

describe("zod schemas", () => {
  it("parses a valid stored hunt", () => {
    const parsed = storedHuntSchema.parse({
      id: 1,
      title: "City Hunt",
      description: "A hunt",
      cluesCount: 3,
      status: "Active",
      rewardType: "XLM",
      rewards: [{ place: 1, amount: 10 }],
    })

    expect(parsed.title).toBe("City Hunt")
  })

  it("rejects an invalid hunt status", () => {
    const result = storedHuntSchema.safeParse({
      id: 1,
      title: "City Hunt",
      description: "A hunt",
      cluesCount: 3,
      status: "Paused",
      rewardType: "XLM",
    })

    expect(result.success).toBe(false)
  })

  it("validates reward, clue, progress, and achievement shapes", () => {
    expect(rewardSchema.safeParse({ place: 1, amount: 5 }).success).toBe(true)
    expect(rewardSchema.safeParse({ place: 1 }).success).toBe(false)

    expect(
      clueSchema.safeParse({
        id: 1,
        huntId: 1,
        question: "Q",
        answer: "A",
        points: 1,
      }).success,
    ).toBe(true)

    expect(
      playerProgressSchema.safeParse({
        hunt_id: 1,
        player: "GABC",
        current_clue_index: 0,
        completed: false,
        reward_claimed: false,
      }).success,
    ).toBe(true)

    expect(
      achievementSchema.safeParse({
        id: "first_win",
        title: "Victory Lap",
        description: "Win your first hunt",
        icon: "🏆",
        rarity: "common",
        condition: "Win 1 hunt",
      }).success,
    ).toBe(true)
  })

  it("exposes a schema lookup map", () => {
    expect(Object.keys(schemas).sort()).toEqual([
      "achievement",
      "clue",
      "playerProgress",
      "reward",
      "storedHunt",
    ])
  })
})
