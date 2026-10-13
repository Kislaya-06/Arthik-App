import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.block,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
    marginRight: Spacing.element,
  },
  screenSubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
  },
  screenTitle: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
    fontFamily: FontFamily.bold,
    marginTop: -2,
  },
  streakBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    gap: Spacing.micro,
    overflow: 'visible',
  },
  streakBadgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: Spacing.block,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  heroTitleWrap: {
    flex: 1,
    marginRight: Spacing.element,
    justifyContent: 'center',
  },
  heroSub: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: FontSize.titleSmall,
    fontFamily: FontFamily.bold,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmountBlock: {
    marginTop: 0,
    marginBottom: 8,
  },
  heroHelperText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    lineHeight: LineHeight.bodySmall,
    marginTop: 3,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: Spacing.group,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatTextWrap: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
    marginBottom: 1,
  },
  heroStatValue: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },

  // Unified Budget & Allowance Card
  unifiedBudgetCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: Spacing.surface,
  },
  // Top Row: Title + Date Pill left, Status Pill right
  ucTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ucTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  ucTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  ucDateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  ucDateBadgeText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.semibold,
  },
  // Status Indicator (Unboxed, high visibility)
  ucStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ucStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  ucStatusText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.1,
  },
  // Body wrapper
  ucBody: {
    gap: 0,
  },
  // Hero Amount Row
  ucHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ucHeroLeft: {
    flex: 1,
  },
  ucHeroLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  ucAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ucHeroCurrencySymbol: {
    fontSize: FontSize.titleMedium,
    fontFamily: FontFamily.bold,
    marginRight: 2,
  },
  ucHeroAmount: {
    fontSize: FontSize.titleLarge,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  ucHeroRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  ucChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ucChangeBtnText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  // Progress Bar
  ucProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 4,
  },
  ucProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  ucProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ucProgressLabelText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  ucProgressLabelValue: {
    fontFamily: FontFamily.bold,
  },
  // Auto-save Feature Row (Unboxed)
  ucAutoSaveCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginTop: 4,
  },
  ucAutoSaveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 6,
  },
  ucAutoSaveTextWrap: {
    flex: 1,
  },
  ucAutoSaveLabel: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    marginBottom: 2,
  },
  ucFooterHint: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: LineHeight.caption,
  },

  // Scheduled Banner
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.element,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.group,
  },
  scheduledBannerTitle: {
    fontSize: FontSize.bodySmall,
  },
  scheduledBannerSubtitle: {
    fontSize: FontSize.micro,
    marginTop: 1,
  },

  // Unified Paused State
  unifiedPausedContent: {
    marginTop: Spacing.nano,
  },
  pausedStateBox: {
    paddingVertical: 2,
  },
  pausedStateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
  },
  pausedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    marginBottom: 2,
  },
  pausedDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },
  pausedDivider: {
    height: 1,
    marginVertical: Spacing.group,
  },
  pausedBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pausedSubLabel: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
    marginBottom: 2,
  },
  pausedAmountText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },

  // History Section
  historySectionHeader: {
    marginTop: 0,
    marginBottom: Spacing.group,
  },
  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  filterToggleWrapper: {
    marginBottom: Spacing.block,
  },

  // Empty state
  emptyCard: {
    paddingVertical: Spacing.gutter,
    paddingHorizontal: Spacing.surface,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.micro,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.group,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },

  depositCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  depositCtaBtnText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.element,
    paddingVertical: 10,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginTop: 24,
    marginBottom: Spacing.element,
  },
  seeMoreText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
