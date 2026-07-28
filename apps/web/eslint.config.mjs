// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook"

import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import jsxA11y from "eslint-plugin-jsx-a11y"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...storybook.configs["flat/recommended"],
]

eslintConfig.push({
  plugins: {
    "jsx-a11y": jsxA11y,
  },
  rules: {
    // Direct console calls bypass the structured logger (@/lib/logger) and can leak
    // values into browser consoles in production, so they're always an error outside
    // tests and scripts (see the override below).
    "no-console": "error",
    "jsx-a11y/control-has-associated-label": "error",
    "jsx-a11y/interactive-supports-focus": "error",
  },
})

// Tests, e2e specs, and standalone scripts legitimately use console output
// (test reporters, CLI progress) and aren't part of the runtime the logger covers.
eslintConfig.push({
  files: [
    "**/__tests__/**",
    "**/*.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}",
    "e2e/**",
    "scripts/**",
  ],
  rules: {
    "no-console": "off",
  },
})

export default eslintConfig
