export type HuntLifecycleStatus = "draft" | "scheduled" | "active" | "ended" | "completed" | "cancelled"

export function normalizeHuntStatus(status?: string): HuntLifecycleStatus {
  const value = status?.toLowerCase()
  switch (value) {
    case "scheduled":
      return "scheduled"
    case "active":
      return "active"
    case "ended":
      return "ended"
    case "completed":
      return "completed"
    case "cancelled":
      return "cancelled"
    case "draft":
    default:
      return "draft"
  }
}

export function getDisplayHuntStatus(status?: string): string {
  switch (normalizeHuntStatus(status)) {
    case "scheduled":
      return "Scheduled"
    case "active":
      return "Active"
    case "ended":
      return "Ended"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    case "draft":
    default:
      return "Draft"
  }
}
