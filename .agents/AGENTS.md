# UI Styling Rules

- **Currency Symbol Alignment**: When displaying a large currency amount alongside a smaller currency symbol (like "₹"), always use `alignItems: 'center'` on the wrapping row container (`flexDirection: 'row'`). Do NOT use `alignItems: 'flex-end'` or bottom margins on the symbol, as this causes the symbol to look misaligned or sink too low relative to the number.
- **Safe Area Insets**: Always use `useSafeAreaInsets` from `react-native-safe-area-context` for avoiding the notch/status bar on screens (e.g. `paddingTop: insets.top`). Do NOT use hardcoded magic numbers like `marginTop: 56` or the standard `SafeAreaView` from `react-native`.
