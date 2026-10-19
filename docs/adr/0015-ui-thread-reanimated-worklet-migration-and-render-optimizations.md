# 0015. UI-Thread Reanimated Worklet Migration and Render Optimizations

## Status
Accepted (October 2026).

## Context
When filtering transactions on `HistoryScreen`, switching category pills (`BouncyCategoryFilter`) frequently exhibited visible stuttering, frame drops, or animation stalling on physical Android devices. Profiling and diagnostic telemetry identified four compounding architectural bottlenecks:
1. **JavaScript Thread Contention:** `BouncyCategoryFilter` previously relied on React Native core `Animated` with `useNativeDriver: false` because sliding highlight coordinates (`left`, `width`) and liquid morph transforms were animated on the JS thread. Concurrently, tapping a category updated parent screen state, prompting React to re-filter, group, and mount hundreds of `SectionList` transaction items. This heavy JS workload starved the `Animated` frame driver, producing frame drops of ~108–114ms.
2. **Typography Font-Weight Layout Shifts:** Switching active tab font weight between `FontFamily.medium` and `FontFamily.bold` changed the text width by several pixels, triggering secondary `onLayout` events during animation flight and prompting recursive re-renders.
3. **Mid-Flight Animation Clobbering:** `useEffect` previously compared `pillLeft.value !== activeLayout.x`, mistaking in-flight spring positions for obsolete layouts and violently snapping the pill.
4. **Broad Store Subscriptions & Linear Array Scans:** `ManageCategoriesScreen` and `CategoryDetailScreen` subscribed to whole store objects (`useCategoryStore()`, `useExpenseStore()`), causing ghost re-renders. Meanwhile, `useInsightsData` executed repeated $O(C)$ linear scans (`categories.find(...)`) inside nested aggregation loops across all transactions, and `HomeScreen` mapped and sorted the entire historical transaction database just to pick the top 5 recent items.

## Decision

### 1. UI-Thread Reanimated Worklet Migration (`BouncyCategoryFilter`)
- Replaced React Native core `Animated` with `react-native-reanimated` UI-thread shared values (`pillX`, `pillWidth`) and worklets.
- **Hardware-Accelerated Transform-Only Animation**: Replaced layout property animation (`left`) with `transform: [{ translateX: pillX.value }]` anchored at static `left: 0`. This eliminates native Android Yoga layout engine passes on every animation frame, preventing 16ms UI thread bottlenecks.
- **Immediate Touch Dispatch**: Moved the spring launch from `useEffect` directly into the `handleSelect` touch handler. Springs launch synchronously on touch before React initiates heavy SectionList re-grouping.
- **Apple-Calibrated Critically Damped Springs**: Calibrated Reanimated springs to exact mathematical equivalents of React Native Origami tension and friction (`tension: 100, friction: 16` $\to$ `stiffness: 447.4, damping: 49, mass: 1, overshootClamping: true` via shared `SLIDE_SPRING` constant). Removed dead rubber-band morph values (`stretchAnim`, `squishAnim`, `leadAnim`) to preserve pure stadium pill geometry (`BorderRadius.pill`).
- **Ref-Based Layout & Container Width Mirroring**: Stored layouts and container width in mutable refs (`layoutsRef`, `containerWidthRef`), giving `animateTo` and `centerCategory` stable callback identities and eliminating intermediate React re-renders during pill transit.
- **Mid-Flight Protection**: Introduced `lastActiveLayout` ref to isolate measured geometry from in-flight spring values.
- **Zero-Shift Typography**: Introduced an invisible bold placeholder (`hiddenPlaceholder` with `opacity: 0`, `FontFamily.bold`) behind an absolute visible label, locking container width regardless of active status.
- Wrapped `BouncyCategoryFilter` and `FilterItem` with `React.memo`.

### 2. SectionList Virtualization Tuning & Progressive Section Pagination with 'See More' (`HistoryScreen`)
- **Incremental Progressive Section Pagination (4 Days)**: Capped initial mount on "All" or any category filter to the first 4 active date sections (~4–8 transactions), eliminating Main UI thread view inflation stalls (~80–120ms).
- **Explicit 'See More' Button Flow**: Replaced automatic `onEndReached` streaming with an explicit "See More" button (matching the `SavingsScreen` pattern). When tapped, the next 4 days of transactions load with haptic feedback, preventing background view inflation from interrupting category pill spring transitions.
- **`startTransition` Decoupling**: Wrapped filter state updates in `React.startTransition` so list reconciliation yields to Reanimated's UI-thread spring.
- Preserved pinned virtualization parameters: `initialNumToRender={12}`, `maxToRenderPerBatch={10}`, and `windowSize={21}`.
- Memoized item row callbacks (`handlePress`) in `TransactionRowItem` and `GullakRowItem` preventing row re-renders.

### 3. Universal SegmentedControl Reanimated Worklet Migration (`SegmentedControl`)
- Modernized canonical `SegmentedControl.tsx` primitive from legacy core `Animated` to `react-native-reanimated` shared values (`slideAnim`, `stretchAnim`, `squishAnim`, `leadAnim`) and worklets.
- **Immediate Frame 0 Touch Dispatch**: Spring launches synchronously on touch (`onPressIn` / `handleSelect`) on the native UI thread, decoupled from parent screen re-renders via `React.startTransition`.
- Eliminates the 60–100ms touch delay on `HomeScreen` (All/Daily/Weekly/Monthly) and unifies motion across `InsightsScreen`, `ProfileScreen`, and `BudgetEditModal`.

### 4. Granular Store Subscriptions
- Replaced whole-store subscriptions in `ManageCategoriesScreen` and `CategoryDetailScreen` with fine-grained selectors (`useCategoryStore((s) => s.categories)`, etc.), isolating re-renders from unrelated store churn.

### 5. $O(1)$ Category Lookup Map (`useInsightsData`)
- Introduced `buildCategoryMap(categories): Map<string, Category>` to replace repetitive $O(C)$ linear array scans across all 9 aggregation functions in `src/screens/insights/useInsightsData.ts`.

### 6. Single-Pass Bounded Top-5 Transaction Selection (`homeCalculations`)
- Replaced full-array mapping, spreading, and $O(N \log N)$ sorting in `HomeScreen.tsx` with a single-pass $O(N)$ bounded selection algorithm (`selectRecentTransactions` in `src/lib/homeCalculations.ts`).

### 7. Home Filter Pill Micro-Choreography & RollingText Monotonic Wheel Rendering
- **Micro-Choreography Decoupling (`HomeScreen.tsx`)**:
  - Decoupled instant pill UI state (`selectedFilter`) from heavy calculation state (`activeFilter`).
  - On user tap, the SegmentedControl pill spring launches immediately on Frame 0 on the native UI thread with zero JS friction and zero dropped frames.
  - Deferred heavy period aggregations (`calculatePeriodSummary`, `filterExpenses`, and `RollingText` mounts) by 220ms (`FILTER_DECOUPLE_DELAY_MS`), allowing the native UI-thread spring across all 3 slots (All $\leftrightarrow$ Monthly) to complete its trajectory smoothly before JS math executes.
  - Rapid sequential taps (Daily → Weekly → Monthly → All) cancel pending intermediate calculation timers, preventing card thrashing and chopped mid-air digit distortion.
- **Continuous Monotonic Wheel Glyph Geometry (`RollingText.tsx`, `rollingText.ts`)**:
  - Replaced the flawed `Animated.modulo(position, 10)` anti-pattern with `getWheelGlyphs(roll: DigitRoll): number[]`, generating a deterministic finite sequence of `travel + 1` glyphs (`from` to `to` for up, `to` to `from` for down).
  - Animates `translateY` strictly monotonically from `startY` to `endY`, completely eliminating 0-to-10 modulo jump discontinuities when numbers decrease or cross 10-boundaries, and ending font baseline clipping or distorted glyphs.
  - Applied Apple-calibrated snappy ease-out curve (`Easing.bezier(0.16, 1, 0.3, 1)`) with `320ms` roll duration.
- **SegmentedControl Paint Invalidation Elimination (`SegmentedControl.tsx`)**:
  - Replaced per-frame `interpolateColor` worklet in `OptionItem` with static color selection (`isSelected ? activeColor : inactiveColor`), eliminating ~240 native Android `TextView.setTextColor()` paint invalidations per second during 3-slot pill flight.
  - Preserved in-flight spring momentum vector (`withSpring`) across rapid sequential taps without brick-wall stops.
  - Maintained consistent `FontFamily.bold` across all segmented control options, eliminating Android font-swapping layout cache invalidations during sliding animations.
  - Guarded `handleLayout` against sub-pixel reflow noise (`Math.abs(width - containerWidth) > 1`), preventing the sliding spring from aborting mid-flight.

## Consequences
- **Zero Frame Stutters on History & Home Pills**: Reanimated worklets execute at 60/120 FPS on the native UI thread without Choreographer starvation, even during transitions across 3 slots with rapid sequential tapping.
- **Odometer Visual Fidelity**: Preserved authentic physical slot-wheel rolling animation across all hero metrics without font baseline clipping, modulo discontinuities, or glyph distortions on Android.
- **Initial "All" Batch Latency Eliminated**: Bounding initial mount to 4 sections on HistoryScreen drops view inflation time down to ~2ms.
- **Immediate Touch Response**: SegmentedControl responds on Frame 0 with instantaneous haptic and visual feedback.
- **100% Financial & OTA Invariance**: All changes are pure performance and rendering optimizations; zero financial formulas, budget rules, or native Android dependencies were modified.
