import { getHuntsByCreator } from "./huntStore";
import type { StoredHunt } from "./types";

export interface CreatorStats {
  huntsPublished: number;
  playersServed: number;
  averageRating: number;
  activeHunts: StoredHunt[];
}

export function getCreatorStats(address: string): CreatorStats {
  const hunts = getHuntsByCreator(address);
  
  const publishedHunts = hunts.filter(h => h.status === "Active" || h.status === "Completed");
  const activeHunts = hunts.filter(h => h.status === "Active" && !h.is_private && !h.isArchived && !h.deletedAt);

  const huntsPublished = publishedHunts.length;
  
  let playersServed = 0;
  let totalRating = 0;
  let ratedHuntsCount = 0;

  for (const hunt of publishedHunts) {
    playersServed += hunt.playerCount || 0;
    
    if (hunt.averageRating && hunt.averageRating > 0) {
      totalRating += hunt.averageRating;
      ratedHuntsCount++;
    }
  }

  const averageRating = ratedHuntsCount > 0 ? totalRating / ratedHuntsCount : 0;

  return {
    huntsPublished,
    playersServed,
    averageRating,
    activeHunts,
  };
}
