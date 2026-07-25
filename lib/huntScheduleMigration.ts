import type { StoredHunt } from "@/lib/types"
import { normalizeHuntStatus } from "@/lib/huntStatus"

export function migrateHuntScheduleFields(hunt: StoredHunt): StoredHunt {
  const startAt = hunt.startAt ?? hunt.startTime
  const endAt = hunt.endAt ?? hunt.endTime

  return {
    ...hunt,
    startAt,
    endAt,
    status: normalizeHuntStatus(hunt.status) as StoredHunt["status"],
  }
}

export function migrateHuntScheduleFieldsInCollection(hunts: StoredHunt[]): StoredHunt[] {
  return hunts.map((hunt) => migrateHuntScheduleFields(hunt))
}
