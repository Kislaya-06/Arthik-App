# Issue 02: Dead Theme.borderRadius keys (.button: 28, .pill: 20) and contradiction with pill convention

Status: ready-for-agent
Type: task

## Description
In `src/config/theme.ts`:
```ts
export const Theme = {
  colors: LightColors,
  borderRadius: {
    card: 24,
    button: 28,
    pill: 20,
    input: 16,
  },
  ...
};
```
- `Theme.borderRadius.button` (28) is unused across the codebase.
- `Theme.borderRadius.pill` (20) is unused across the codebase, and contradicts the actual pill/stadium convention documented in `AGENTS.md` 9.2 and used across screens (`borderRadius: 9999`).

## Proposed Action
Remove the dead `button` (28) and `pill` (20) keys from `Theme.borderRadius` and deprecate/merge the legacy `Theme.borderRadius` into the canonical `BorderRadius` token set.
