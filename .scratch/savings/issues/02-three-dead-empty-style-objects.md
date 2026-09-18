# three dead empty style objects in SavingsScreen

Status: needs-triage

## Description

In `src/screens/SavingsScreen.tsx`, `filterPillActive`, `filterPillInactive`, and `filterPillTextInactive` are defined as completely empty style objects `{}` in `StyleSheet.create`:

```typescript
// src/screens/SavingsScreen.tsx:1126-1127, 1135
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

Meanwhile, the JSX in `src/screens/SavingsScreen.tsx` lines 686-700 applies inline ternary style arrays directly with theme colors:

```tsx
// src/screens/SavingsScreen.tsx:686-700
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

## Impact

The three style keys (`filterPillActive`, `filterPillInactive`, `filterPillTextInactive`) are dead empty placeholders left over from earlier styling passes. 

Priority: Low / cosmetic. Can be cleaned up during style consolidation.
