/**
 * @hunty/types
 *
 * Central type re-exports for the Hunty monorepo.
 * Apps and packages import shared types from here.
 *
 * NOTE: The canonical type definitions still live in:
 *   - ../../apps/web/lib/types.ts (app domain types)
 *   - ../../apps/web/shared/types/components.ts (UI component types)
 *
 * This package provides a single stable import path for cross-package consumption.
 */

// ─── Shared UI component prop interfaces ─────────────────────────────────────
export type {
  ButtonVariant,
  ButtonSize,
  SharedButtonProps,
  SharedCardProps,
  BadgeVariant,
  SharedBadgeProps,
  SharedEmptyStateAction,
  SharedEmptyStateProps,
} from "./component-types"

// ─── Design tokens (re-exported for type usage) ───────────────────────────────
export type { ColorToken, SpacingToken } from "./token-types"
