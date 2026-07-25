"use client"

import { useCallback, useContext, useEffect, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { WalletContext } from "@/lib/context/WalletContext"
import { fetchPlayerNfts } from "@/lib/nftUtils"
import { queryCachePolicy, queryKeys } from "@/lib/queryKeys"
import {
  describeWalletBalanceError,
  fetchXlmBalance,
  formatXlmAmount,
  WalletBalanceError,
  type NftCountSnapshot,
  type XlmBalanceSnapshot,
} from "@/lib/wallet/balance"
import {
  subscribeToWalletBalanceEvents,
  type WalletBalanceDelta,
} from "@/lib/wallet/balanceEvents"

/** How long an unconfirmed optimistic value may stand before we force a refetch. */
export const OPTIMISTIC_RECONCILE_MS = 6_000

/** Transient failures worth retrying; a bad address or unreadable payload is not. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof WalletBalanceError) {
    if (error.kind === "invalid-address" || error.kind === "parse") return false
  }
  return failureCount < 2
}

const retryDelay = (attempt: number) => Math.min(1_000 * 2 ** attempt, 8_000)

export type WalletBalanceState = {
  /** Address the balance belongs to, or `""` when no wallet is connected. */
  address: string
  /** Native XLM balance; `null` until the first successful read. */
  xlm: number | null
  /** `xlm` rendered for display, or `"—"` when unknown. */
  formattedXlm: string
  /** Number of NFTs owned; `null` until the first successful read. */
  nftCount: number | null
  /** True when Horizon has no record of the account (never funded). */
  unfunded: boolean
  /** First load with nothing to display yet. */
  isLoading: boolean
  /** A refresh is in flight while a previous value is already on screen. */
  isRefreshing: boolean
  /** Showing a predicted value that chain state has not confirmed. */
  isOptimistic: boolean
  /** User-facing failure message, or `null` when the last read succeeded. */
  error: string | null
  /** The latest read failed but a previous value is still being shown. */
  isStale: boolean
  /** Epoch millis of the last successful read, or `null`. */
  lastUpdated: number | null
  /** Forces an immediate refetch of both balance and NFT count. */
  refresh: () => void
  /** Applies a predicted change locally, pending confirmation. */
  applyOptimisticDelta: (delta: WalletBalanceDelta) => void
}

/**
 * Live wallet balance for the connected account.
 *
 * - Polls Horizon every 30s (see `queryCachePolicy.walletBalance`) and refetches
 *   on window focus and network reconnect.
 * - Survives network trouble: a failed poll leaves the last known value on
 *   screen and reports `isStale` with a readable `error`, instead of blanking
 *   the balance or throwing.
 * - Accepts optimistic updates, either directly via `applyOptimisticDelta` or
 *   from anywhere in the app via `predictWalletBalanceChange`. Predictions are
 *   reconciled by `settleWalletBalance`, by a {@link OPTIMISTIC_RECONCILE_MS}
 *   safety timer, and ultimately by the next poll.
 *
 * Reads the connected address from `WalletContext` when one is available, so it
 * is safe to call outside a `WalletProvider` (it simply stays idle).
 */
export function useWalletBalance(options: { address?: string } = {}): WalletBalanceState {
  const wallet = useContext(WalletContext)
  const contextAddress = wallet?.connected ? wallet.publicKey : ""
  const address = options.address ?? contextAddress ?? ""
  const enabled = address.length > 0

  const queryClient = useQueryClient()
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const balanceKey = useMemo(() => queryKeys.wallet.balance(address), [address])
  const nftKey = useMemo(() => queryKeys.wallet.nftCount(address), [address])

  const balanceQuery = useQuery<XlmBalanceSnapshot>({
    queryKey: balanceKey,
    queryFn: ({ signal }) => fetchXlmBalance(address, { signal }),
    enabled,
    staleTime: queryCachePolicy.walletBalance.staleTime,
    gcTime: queryCachePolicy.walletBalance.gcTime,
    refetchInterval: queryCachePolicy.walletBalance.refetchInterval,
    // Polling a rate-limited public Horizon instance from a hidden tab wastes
    // the budget; `refetchOnWindowFocus` brings the value up to date the moment
    // the user comes back.
    refetchIntervalInBackground: false,
    retry: shouldRetry,
    retryDelay,
  })

  const nftQuery = useQuery<NftCountSnapshot>({
    queryKey: nftKey,
    queryFn: async () => ({
      address,
      count: (await fetchPlayerNfts(address)).length,
      fetchedAt: Date.now(),
      optimistic: false,
    }),
    enabled,
    staleTime: queryCachePolicy.walletBalance.staleTime,
    gcTime: queryCachePolicy.walletBalance.gcTime,
    refetchInterval: queryCachePolicy.walletBalance.refetchInterval,
    refetchIntervalInBackground: false,
    retry: shouldRetry,
    retryDelay,
  })

  const clearReconcileTimer = useCallback(() => {
    if (reconcileTimer.current) {
      clearTimeout(reconcileTimer.current)
      reconcileTimer.current = null
    }
  }, [])

  const refresh = useCallback(() => {
    clearReconcileTimer()
    if (!enabled) return
    void queryClient.invalidateQueries({ queryKey: balanceKey })
    void queryClient.invalidateQueries({ queryKey: nftKey })
  }, [clearReconcileTimer, enabled, queryClient, balanceKey, nftKey])

  const applyOptimisticDelta = useCallback(
    (delta: WalletBalanceDelta) => {
      if (!enabled) return
      const { xlmDelta = 0, nftDelta = 0 } = delta

      if (xlmDelta !== 0) {
        queryClient.setQueryData<XlmBalanceSnapshot>(balanceKey, (previous) =>
          previous
            ? // A balance can never go negative, so a prediction that would
              // overshoot is clamped rather than rendered as nonsense.
              { ...previous, xlm: Math.max(0, previous.xlm + xlmDelta), optimistic: true }
            : previous,
        )
      }

      if (nftDelta !== 0) {
        queryClient.setQueryData<NftCountSnapshot>(nftKey, (previous) =>
          previous
            ? { ...previous, count: Math.max(0, previous.count + nftDelta), optimistic: true }
            : previous,
        )
      }

      // Safety net: if no settle event ever arrives (a transaction helper that
      // does not report back, a dropped promise), reconcile anyway.
      clearReconcileTimer()
      reconcileTimer.current = setTimeout(refresh, OPTIMISTIC_RECONCILE_MS)
    },
    [enabled, queryClient, balanceKey, nftKey, clearReconcileTimer, refresh],
  )

  useEffect(() => {
    return subscribeToWalletBalanceEvents((event) => {
      if (event.type === "optimistic") {
        applyOptimisticDelta({ xlmDelta: event.xlmDelta, nftDelta: event.nftDelta })
      } else {
        refresh()
      }
    })
  }, [applyOptimisticDelta, refresh])

  useEffect(() => clearReconcileTimer, [clearReconcileTimer])

  const balanceData = balanceQuery.data
  const nftData = nftQuery.data

  // The balance is the headline figure, so its failure wins the error slot; an
  // NFT-count failure only surfaces when the balance itself loaded fine.
  const failure = balanceQuery.error ?? nftQuery.error
  const error = failure ? describeWalletBalanceError(failure) : null
  const hasValue = balanceData != null || nftData != null

  return {
    address,
    xlm: balanceData?.xlm ?? null,
    formattedXlm: formatXlmAmount(balanceData?.xlm ?? null),
    nftCount: nftData?.count ?? null,
    unfunded: balanceData?.unfunded ?? false,
    isLoading: enabled && !hasValue && (balanceQuery.isPending || nftQuery.isPending),
    isRefreshing: hasValue && (balanceQuery.isFetching || nftQuery.isFetching),
    isOptimistic: Boolean(balanceData?.optimistic || nftData?.optimistic),
    error,
    isStale: Boolean(error) && hasValue,
    lastUpdated: balanceData?.fetchedAt ?? null,
    refresh,
    applyOptimisticDelta,
  }
}
