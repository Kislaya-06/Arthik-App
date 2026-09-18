# Issue 01: ErrorBoundary.tsx uses fontFamily 'monospace', violating AGENTS.md 9.2

Status: ready-for-agent
Type: task

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
