import { describe, it, expect, vi, beforeEach } from "vitest"

const store = new Map<string, string>()

vi.mock("fs", () => ({
  default: {
    readFileSync: (path: string) => {
      const val = store.get(path)
      if (val === undefined) throw new Error(`ENOENT: ${path}`)
      return val
    },
    writeFileSync: (path: string, data: string) => {
      store.set(path, data)
    },
    existsSync: (path: string) => store.has(path),
    mkdirSync: () => undefined,
  },
  readFileSync: (path: string) => {
    const val = store.get(path)
    if (val === undefined) throw new Error(`ENOENT: ${path}`)
    return val
  },
  writeFileSync: (path: string, data: string) => {
    store.set(path, data)
  },
  existsSync: (path: string) => store.has(path),
  mkdirSync: () => undefined,
}))

import {
  submitHuntForModeration,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  getCreatorNotifications,
  __resetModerationStoreForTests,
} from "@/lib/moderation/store"
import { createHunt } from "@/lib/test-utils/factories"

describe("moderation store", () => {
  beforeEach(() => {
    store.clear()
    store.set(`${process.cwd()}/lib/moderation-data/queue.json`, "[]")
    store.set(`${process.cwd()}/lib/moderation-data/notifications.json`, "[]")
    __resetModerationStoreForTests()
  })

  it("queues hunt submissions with auto flags", () => {
    const hunt = createHunt({
      id: 42,
      title: "CASINO BONUS QUEST",
      description: "Short",
      rewardPool: 50,
    })
    const submission = submitHuntForModeration(hunt)
    expect(submission.status).toBe("pending")
    expect(submission.autoFlags.length).toBeGreaterThan(0)
    expect(getPendingSubmissions()).toHaveLength(1)
  })

  it("approves and notifies creator", () => {
    const hunt = createHunt({ id: 7, creatorEmail: "creator@example.com" })
    const submission = submitHuntForModeration(hunt)
    const approved = approveSubmission(submission.id)
    expect(approved?.status).toBe("approved")
    expect(getPendingSubmissions()).toHaveLength(0)
    const notifications = getCreatorNotifications("creator@example.com")
    expect(notifications.some((n) => n.action === "approved")).toBe(true)
  })

  it("rejects with reason and notifies creator", () => {
    const hunt = createHunt({ id: 8, creatorEmail: "creator@example.com" })
    const submission = submitHuntForModeration(hunt)
    const rejected = rejectSubmission(submission.id, "Misleading reward copy", ["misleading"])
    expect(rejected?.status).toBe("rejected")
    expect(rejected?.rejectionReason).toBe("Misleading reward copy")
    const notifications = getCreatorNotifications("creator@example.com")
    expect(notifications.some((n) => n.action === "rejected" && n.reason?.includes("Misleading"))).toBe(
      true
    )
  })
})
