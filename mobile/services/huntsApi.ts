import type { StoredHunt } from '@lib/types';
import { getActiveHuntsForFeed, getHuntById } from '@store/huntStore';

import { fetchActiveHuntsFromIndexer, fetchHuntByIdFromIndexer } from '@/lib/graphql/hunts';

/**
 * Fetch active hunts from the Hunty GraphQL indexer, falling back to local seed
 * data when the indexer is unreachable or not configured.
 */
export async function getActiveHuntsNetworkFirst(): Promise<StoredHunt[]> {
  try {
    const hunts = await fetchActiveHuntsFromIndexer();
    if (hunts.length > 0) return hunts;
  } catch (error) {
    console.warn('[huntsApi] GraphQL fetch failed, using local fallback:', error);
  }
  return getActiveHuntsForFeed();
}

export async function getHuntNetworkFirst(id: number): Promise<StoredHunt | undefined> {
  try {
    const hunt = await fetchHuntByIdFromIndexer(id);
    if (hunt) return hunt;
  } catch (error) {
    console.warn('[huntsApi] GraphQL hunt fetch failed, using local fallback:', error);
  }
  return getHuntById(id);
}
