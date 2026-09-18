# Issue 03: Theme.colors is hard-coded to LightColors

Status: needs-triage
Type: task

## Description
In `src/config/theme.ts`:
```ts
export const Theme = {
  colors: LightColors,
  ...
};
```
`Theme.colors` is statically bound to `LightColors`. Any consumer reading `Theme.colors` will always receive light theme colors even when the user has dark mode enabled.

## Current Audit & Impact
- Currently, **0 places** in the codebase read `Theme.colors`.
- All screens and components read `colors` dynamically via `const { colors } = useTheme()`.
- In `src/store/themeStore.ts`, `useTheme()` returns `theme: { ...Theme, colors }` where `colors` overrides `Theme.colors` dynamically.
- However, direct imports of `Theme.colors` remain dangerous if developers mistakenly import `Theme.colors` instead of calling `useTheme()`.

## Proposed Action
Evaluate removing `Theme.colors` or turning `Theme` into a function `getTheme(isDark: boolean)` / dynamic getter to avoid accidental static light-theme leakage.
