# three dead empty style objects in SavingsScreen

Status: resolved

## Description

In `src/screens/SavingsScreen.tsx`, `filterPillActive`, `filterPillInactive`, and `filterPillTextInactive` were defined as completely empty style objects `{}` in `StyleSheet.create`:

```typescript
// src/screens/SavingsScreen.tsx (prior to cleanup)
  filterPillActive: {},
  filterPillInactive: {},
  filterPillText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },
  filterPillTextActive: {
    fontFamily: FontFamily.bold,
  },
  filterPillTextInactive: {},
```

Meanwhile, the JSX in `src/screens/SavingsScreen.tsx` applied inline ternary style arrays directly with theme colors referencing those empty keys:

```tsx
// src/screens/SavingsScreen.tsx (prior to cleanup)
  style={[
    styles.filterPill,
    active
      ? [styles.filterPillActive, { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }]
      : [styles.filterPillInactive, { backgroundColor: colors.card, borderColor: colors.border }],
  ]}
  activeOpacity={0.75}
>
  <Text
    style={[
      styles.filterPillText,
      active
        ? [styles.filterPillTextActive, { color: colors.textPrimary }]
        : [styles.filterPillTextInactive, { color: colors.textSecondary }],
    ]}
  >
```

## Resolution

Resolved in branch `chore/savings-cleanup`.
1. The three dead empty objects (`filterPillActive: {}`, `filterPillInactive: {}`, and `filterPillTextInactive: {}`) were removed from `StyleSheet.create`.
2. The JSX inline style arrays in `src/screens/SavingsScreen.tsx` were updated to directly apply the active/inactive theme color objects without referencing the removed empty keys.
3. Visual output and rendered styles remain 100% pixel-identical.
