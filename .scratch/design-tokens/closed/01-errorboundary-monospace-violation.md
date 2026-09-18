# Issue 01: ErrorBoundary.tsx uses fontFamily 'monospace', violating AGENTS.md 9.2

Status: closed
Type: task

## Resolution

Closed in mid-September 2026: Decided the code was right and AGENTS.md was incomplete; AGENTS.md Section 9.2 was updated to explicitly permit monospace for developer diagnostic stack traces rendered under __DEV__ in ErrorBoundary. The monospace styling in ErrorBoundary must NOT be changed.

## Description
In `src/components/ErrorBoundary.tsx` at line 147, `devErrorText` style uses `fontFamily: 'monospace'`:
```tsx
devErrorText: {
  fontSize: 11,
  color: '#DC2626',
  fontFamily: 'monospace',
},
```

Per `AGENTS.md` Section 9.2:
> "Typography is Quicksand only (`Quicksand_400Regular/500Medium/600SemiBold/700Bold`). No system fonts."

## Proposed Action
Replace `fontFamily: 'monospace'` with one of the standard Quicksand weights or decide if developer error stack traces should have an explicit exemption in `AGENTS.md`.
