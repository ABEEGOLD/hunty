/**
 * Off-chain creator profile store backed by localStorage.
 * Maps Stellar address → { address, bio, links }.
 */

export interface CreatorLink {
  title: string;
  url: string;
}

export interface CreatorProfile {
  address: string;
  bio?: string;
  links?: CreatorLink[];
}

const STORAGE_KEY = "hunty:creatorProfiles";

function loadAll(): Record<string, CreatorProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CreatorProfile>) : {};
  } catch {
    return {};
  }
}

function saveAll(profiles: Record<string, CreatorProfile>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getCreatorProfile(address: string): CreatorProfile | undefined {
  return loadAll()[address];
}

export function setCreatorProfile(address: string, profile: Partial<CreatorProfile>): void {
  const all = loadAll();
  all[address] = { ...all[address], address, ...profile };
  saveAll(all);
}
