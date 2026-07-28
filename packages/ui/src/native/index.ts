/**
 * Native (React Native / Expo) shared UI components.
 * Import as: import { Button } from '@hunty/ui/native'
 *
 * NOTE: Native component implementations live in apps/mobile/components
 * and depend on React Native / Expo APIs. This package provides the
 * platform-agnostic types; the implementations are within the mobile app.
 *
 * Type re-exports so consumers can use `@hunty/ui/native` for type checking
 * without pulling in the full React Native implementation.
 */
export type {
  SharedButtonProps as ButtonProps,
  SharedCardProps as CardProps,
  SharedBadgeProps as BadgeProps,
  SharedEmptyStateProps as EmptyStateProps,
} from "@hunty/types"
