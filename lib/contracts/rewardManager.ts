"use client"

import { getActiveWalletAdapter } from "@/lib/walletAdapter"
import { getHunt, updateHuntRewardEscrow } from "@/lib/huntStore"
import type { Reward, RewardReceipt } from "@/lib/types"

type RewardType = "XLM" | "NFT" | "Both"

export interface RewardEscrow {
  huntId: number
  creator: string
  rewardType: RewardType
  rewards: Reward[]
  totalPool: number
  balance: number
  expiresAt: number
  depositTxHash: string
  receipts: RewardReceipt[]
  distributions: RewardReceipt[]
  refunds: RewardReceipt[]
}

export type ClaimRewardResult = {
  txHash: string
  amount: number
  receipt: RewardReceipt
}

type CreateRewardEscrowInput = {
  huntId: number
  rewardType: RewardType
  rewards: Reward[]
  expiresAt: number
}

type ClaimRewardOptions = {
  signal?: AbortSignal
  onStage?: (stage: string) => void
}

const ESCROW_KEY_PREFIX = "hunty_reward_escrow_"
const RECEIPT_KEY_PREFIX = "hunty_reward_receipt_"
const CLAIM_TIMEOUT_MS = 120_000
const MAX_RETRIES = 2

export class ClaimTimeoutError extends Error {
  constructor() {
    super("Reward claim timed out. Please try again.")
    this.name = "ClaimTimeoutError"
  }
}

export class ClaimRejectedError extends Error {
  constructor() {
    super("Transaction was rejected in your wallet.")
    this.name = "ClaimRejectedError"
  }
}

function storageKey(huntId: number) {
  return `${ESCROW_KEY_PREFIX}${huntId}`
}

function receiptKey(huntId: number, playerAddress: string) {
  return `${RECEIPT_KEY_PREFIX}${huntId}_${playerAddress}`
}

function sumRewards(rewards: Reward[]): number {
  return rewards.reduce((total, reward) => total + reward.amount, 0)
}

function makeTxHash(prefix: string, huntId: number): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${huntId}_${Date.now()}_${random}`
}

function readEscrow(huntId: number): RewardEscrow | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(huntId))
    return raw ? (JSON.parse(raw) as RewardEscrow) : null
  } catch {
    return null
  }
}

function writeEscrow(escrow: RewardEscrow): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(escrow.huntId), JSON.stringify(escrow))
}

function deriveEscrowFromHunt(huntId: number): RewardEscrow | null {
  const hunt = getHunt(String(huntId))
  if (!hunt) return null

  const totalPool = hunt.rewardType === "NFT" ? 0 : hunt.rewardPool ?? hunt.rewardEscrowBalance ?? 0
  const depositTxHash = hunt.rewardEscrowTxHash ?? makeTxHash("deposit", huntId)
  const rewardType = hunt.rewardType as RewardType
  const rewards = hunt.rewards ?? []
  const depositReceipt: RewardReceipt | null = depositTxHash
    ? {
        id: `deposit_${huntId}`,
        huntId,
        type: "deposit",
        txHash: depositTxHash,
        amount: totalPool,
        createdAt: (hunt.createdAt ?? Math.floor(Date.now() / 1000)) * 1000,
      }
    : null

  return {
    huntId,
    creator: "",
    rewardType,
    rewards,
    totalPool,
    balance: hunt.rewardEscrowBalance ?? totalPool,
    expiresAt: hunt.endTime ?? Math.floor(Date.now() / 1000),
    depositTxHash,
    receipts: depositReceipt ? [depositReceipt] : [],
    distributions: [],
    refunds: [],
  }
}

function persistRewardState(escrow: RewardEscrow): void {
  writeEscrow(escrow)
  updateHuntRewardEscrow(escrow.huntId, escrow.balance, escrow.depositTxHash)
}

export async function createRewardEscrow(input: CreateRewardEscrowInput): Promise<RewardEscrow> {
  if (typeof window === "undefined") {
    throw new Error("Browser environment required")
  }

  const wallet = getActiveWalletAdapter()
  const creator = await wallet.getPublicKey()
  const totalPool = input.rewardType === "NFT" ? 0 : sumRewards(input.rewards)
  const depositTxHash = makeTxHash("deposit", input.huntId)
  const depositReceipt: RewardReceipt = {
    id: `deposit_${input.huntId}`,
    huntId: input.huntId,
    type: "deposit",
    txHash: depositTxHash,
    amount: totalPool,
    from: creator,
    createdAt: Date.now(),
  }

  const escrow: RewardEscrow = {
    huntId: input.huntId,
    creator,
    rewardType: input.rewardType,
    rewards: input.rewards,
    totalPool,
    balance: totalPool,
    expiresAt: input.expiresAt,
    depositTxHash,
    receipts: [depositReceipt],
    distributions: [],
    refunds: [],
  }

  persistRewardState(escrow)
  return escrow
}

export function getRewardEscrow(huntId: number): RewardEscrow | null {
  return readEscrow(huntId) ?? deriveEscrowFromHunt(huntId)
}

export function getRewardHistory(huntId: number): RewardReceipt[] {
  return getRewardEscrow(huntId)?.receipts ?? []
}

export function getPlayerRewardReceipt(huntId: number, playerAddress?: string): RewardReceipt | null {
  if (!playerAddress || typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(receiptKey(huntId, playerAddress))
    return raw ? (JSON.parse(raw) as RewardReceipt) : null
  } catch {
    return null
  }
}

export async function claimReward(huntId: number, options?: ClaimRewardOptions): Promise<ClaimRewardResult> {
  if (typeof window === "undefined") {
    throw new Error("Browser environment required")
  }

  const { signal, onStage } = options ?? {}
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (signal?.aborted) throw new ClaimTimeoutError()
      if (attempt > 0) onStage?.("retrying")

      onStage?.("approving")
      const escrow = getRewardEscrow(huntId)
      if (!escrow) throw new Error("No reward escrow found for this hunt")
      if (escrow.balance <= 0) throw new Error("No XLM reward is available for this hunt")

      onStage?.("confirming")
      const rank = escrow.distributions.length + 1
      const amount = escrow.rewards.find((reward) => reward.place === rank)?.amount ?? escrow.balance
      if (amount <= 0) throw new Error("No XLM reward is available for this hunt")

      const wallet = getActiveWalletAdapter()
      const playerAddress = await wallet.getPublicKey()
      const txHash = makeTxHash("claim", huntId)
      const receipt: RewardReceipt = {
        id: `claim_${huntId}_${rank}`,
        huntId,
        type: "claim",
        txHash,
        amount,
        from: escrow.creator || undefined,
        to: playerAddress,
        rank,
        createdAt: Date.now(),
      }

      const nextEscrow: RewardEscrow = {
        ...escrow,
        balance: Math.max(0, escrow.balance - amount),
        distributions: [...escrow.distributions, receipt],
        receipts: [...escrow.receipts, receipt],
      }

      persistRewardState(nextEscrow)
      localStorage.setItem(receiptKey(huntId, playerAddress), JSON.stringify(receipt))

      return { txHash, amount, receipt }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (signal?.aborted) throw new ClaimTimeoutError()

      const message = lastError.message.toLowerCase()
      const isRejection = message.includes("reject") || message.includes("cancel") || message.includes("denied")
      if (isRejection) throw new ClaimRejectedError()

      if (lastError instanceof ClaimTimeoutError && attempt < MAX_RETRIES) {
        continue
      }

      throw lastError
    }
  }

  throw lastError ?? new Error("Reward claim failed")
}

export async function refundUnclaimedRewards(huntId: number): Promise<RewardReceipt> {
  if (typeof window === "undefined") {
    throw new Error("Browser environment required")
  }

  const escrow = getRewardEscrow(huntId)
  if (!escrow) throw new Error("No reward escrow found for this hunt")
  if (Date.now() < escrow.expiresAt * 1000) {
    throw new Error("Rewards can only be refunded after the hunt expires")
  }
  if (escrow.balance <= 0) throw new Error("No unclaimed rewards remain")

  const wallet = getActiveWalletAdapter()
  const creator = escrow.creator || (await wallet.getPublicKey())
  const amount = escrow.balance
  const receipt: RewardReceipt = {
    id: `refund_${huntId}`,
    huntId,
    type: "refund",
    txHash: makeTxHash("refund", huntId),
    amount,
    to: creator,
    createdAt: Date.now(),
  }

  const nextEscrow: RewardEscrow = {
    ...escrow,
    balance: 0,
    refunds: [...escrow.refunds, receipt],
    receipts: [...escrow.receipts, receipt],
  }

  persistRewardState(nextEscrow)
  return receipt
}

export async function distributeCompletionReward(huntId: number, _playerAddress?: string): Promise<ClaimRewardResult> {
  return claimReward(huntId)
}


