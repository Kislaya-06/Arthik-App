# 0020. Transform-Only Pills, Commit After Landing, and the Touch Fence

## Status
Accepted (27 October 2026). OTA-only (no native change). Supersedes the "commit at `PILL_COMMIT_MS` = 200ms for overlap" part of the motion notes in `docs/design-system.md` and `docs/CODEBASE_GUIDE.md`.

## Context
Pill jitter on Home (All / Daily / Weekly / Monthly), Expense | Income (after the + button) and the History category filter kept coming back after several fixes, on some phones more than others. Reading Reanimated 4.5.1's native code showed three causes:

1. **A React commit freezes Reanimated.** `ReanimatedCommitHook` calls `pauseReanimatedCommits()` for every React commit and `ReanimatedMountHook` unpauses only after that commit is mounted. Every animation frame in between is skipped, then the pill jumps. Screens were told about a tap at 200ms, when the pill still had 6-12px to travel (Home, Expense | Income) and 10-80px on History (its spring is slower). The freeze showed in exactly that last stretch.
2. **`width` was animated.** It is a layout prop: every frame dirtied Yoga and needed a full shadow-tree commit.
3. **History animated Text `color` on every chip.** A colour change rebuilds the text, so Android re-measured nearby chips every frame.

A fourth, smaller source is Reanimated's 500ms "settled props" sync (`PropsRegistryGarbageCollector`), which makes a tiny React commit 1-2s after an animation. Only the native static flag `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` removes it fully; the owner chose OTA-only, so that flag is NOT enabled. Because the pill now animates only transform / opacity / colour, that commit has no layout work and is as short as a commit can be.

## Decision
1. **Commit after landing.** `commitOnSettle` pills deliver `onChange` only when both edges are within 1px of the target. The time is computed per tap from the real springs: `pillLandingMs` (segmented) and `categoryPillLandingMs` (History, `SLIDE_SPRING` with overshoot clamping). `PILL_COMMIT_MS` (= `PILL_SETTLE_MS`, 320ms) is only the fallback before the control is measured.
2. **Transform-only pill.** The pill is drawn as two round caps + one flat middle that is scaled (`pillPiecesFor`). A flat rectangle can be scaled without squashing a corner, so the shape and motion are the same as before. The cap's inner part is flat for `CAP_FLAT_PX`, so the middle's cut edge always lies under a flat part of a cap (no anti-aliasing seam). The shadow is one separate box with `boxShadow` and no fill, drawn first (always under). Pieces overlap, so pill colours must be opaque; anything not provably opaque (`isOpaqueColor`) falls back to one scaled box.
3. **History labels cross-fade by opacity** (two bold copies of the same text, static colours), like `SegmentedControl` already did.
4. **Touch fence (`src/lib/selectionCommitFence.ts`).** A deferred value must never be read stale (tap Income, then Save). Each pending selection registers a flush. `App.tsx`'s root `onTouchStart` flushes all of them synchronously before any other touch can reach its `onPress` (which fires on touch end). A touch that starts on the same pill is claimed by that pill first (bubbling order), so re-taps never force an early commit. Unmount also delivers the pending value.

## Consequences
- The pill motion (springs, stretch, colours, haptics) is unchanged. Screen content (Home numbers, form, History list) updates when the pill lands: about 300-350ms on segmented pills, 340-560ms on History depending on distance, instead of 200ms.
- Pills that do not use `commitOnSettle` (Cash/UPI, Profile theme, Insights, Savings history, Manage Categories, Review sheet, Budget edit) get the transform-only drawing but keep reporting at once.
- Tests: `tests/pillButterySmooth.test.ts` (landing math, piece geometry, no layout prop / text colour in any animated style, fence), plus behaviour tests in `segmentedControl.test.ts` and `bouncyCategoryFilter.test.ts`.

## What Would Have to Be True to Revisit
- If a native build is ever made for another reason, enabling `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` in `package.json` (`reanimated.staticFeatureFlags`) would let transform / opacity skip the shadow tree entirely; it needs on-device testing app-wide (it changes every Reanimated animation).
- If Reanimated stops pausing its commits during React commits, the "commit after landing" wait could be shortened again.
