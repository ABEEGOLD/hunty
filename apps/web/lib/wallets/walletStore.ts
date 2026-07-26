/**
 * Zustand wallet store.
 *
 * Central source of truth for wallet connection state.
 * Persists the last-used provider to localStorage so the app can
 * restore the session on the next visit.
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { WalletProvider } from "./types"

export type WalletState = {
  /** Whether a wallet is currently connected */
  connected: boolean
  /** Full Stellar public key (empty string when disconnected) */
  publicKey: string
  /** The provider that established the current connection */
  provider: WalletProvider | null
  /** The last provider the user explicitly connected with */
  lastUsedProvider: WalletProvider | null
  /** In-progress connection attempt */
  connecting: boolean
  /** Last connection error message, if any */
  error: string | null
}

export type WalletActions = {
  /** Mark wallet as connected with the given key and provider */
  setConnected: (publicKey: string, provider: WalletProvider) => void
  /** Clear connection state */
  setDisconnected: () => void
  /** Track connection attempt in progress */
  setConnecting: (connecting: boolean) => void
  /** Store an error message */
  setError: (error: string | null) => void
  /** Override last-used provider (e.g., if session is restored externally) */
  setLastUsedProvider: (provider: WalletProvider) => void
}

export type WalletStore = WalletState & WalletActions

const initialState: WalletState = {
  connected: false,
  publicKey: "",
  provider: null,
  lastUsedProvider: null,
  connecting: false,
  error: null,
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      ...initialState,

      setConnected: (publicKey, provider) =>
        set({
          connected: true,
          publicKey,
          provider,
          lastUsedProvider: provider,
          connecting: false,
          error: null,
        }),

      setDisconnected: () =>
        set({
          connected: false,
          publicKey: "",
          provider: null,
          connecting: false,
          error: null,
          // lastUsedProvider is intentionally preserved for UX continuity
        }),

      setConnecting: (connecting) => set({ connecting, error: null }),

      setError: (error) => set({ error, connecting: false }),

      setLastUsedProvider: (provider) => set({ lastUsedProvider: provider }),
    }),
    {
      name: "hunty_wallet_store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : memoryStorage()
      ),
      // Only persist non-sensitive fields
      partialize: (state) => ({
        lastUsedProvider: state.lastUsedProvider,
      }),
    }
  )
)

// Minimal in-memory storage for SSR safety
function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
    get length() { return store.size },
    key: (i) => [...store.keys()][i] ?? null,
  }
}
