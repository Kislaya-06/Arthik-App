import { StyleSheet } from 'react-native';
import { Spacing, FontSize, FontFamily, LineHeight } from '../config/theme';

// ─── Styles ───────────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSection: {
    paddingHorizontal: Spacing.gutter,
    flexShrink: 0,
  },
  portalWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    flex: 1,
    marginRight: 14,
    justifyContent: 'center',
  },
  helloText: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.medium,
  },
  nameText: {
    fontSize: FontSize.display,
    lineHeight: LineHeight.display,
    fontFamily: FontFamily.bold,
    marginTop: -4,
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  networkStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: -2,
  },
  networkStatusText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
  },

  // Filter toggle
  filterToggleWrapper: {
    marginTop: Spacing.block,
  },
  heroHint: { textAlign: 'center', fontSize: 11, fontFamily: FontFamily.medium, marginTop: 6 },
  filterDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.group,
    marginBottom: Spacing.block,
  },
  filterDateLabel: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.semibold,
    opacity: 0.85,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  setLimitAffordance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  setLimitDot: {
    fontSize: FontSize.caption,
    opacity: 0.5,
    marginRight: 6,
  },
  setLimitText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.block,
    paddingBottom: Spacing.element,
    zIndex: 10,
  },
  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  historyAffordanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  historyAffordanceText: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.semibold,
  },
  viewportSlotLine: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.micro,
  },

  // Rows block (clips row shadows/edges to the block, same as before)
  recentTxViewport: {
    overflow: 'hidden',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: Spacing.surface,
    paddingHorizontal: Spacing.gutter,
  },
  emptyText: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
});
