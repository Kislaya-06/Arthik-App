import { StyleSheet } from 'react-native';
import {
  Spacing, BorderRadius, FontSize, FontFamily, LineHeight,
} from '../../config/theme';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.block,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.gutter,
  },
  headerTitle: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    padding: Spacing.micro,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.pill,
  },
  segmentText: { fontSize: FontSize.caption },
  heroCard: {
    borderRadius: BorderRadius.cardLarge,
    paddingHorizontal: Spacing.surface,
    paddingTop: Spacing.surface,
    paddingBottom: Spacing.gutter,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCircle1: {
    position: 'absolute', top: -50, right: -20,
    width: 200, height: 200, borderRadius: 100, opacity: 0.5,
  },
  heroCircle2: {
    position: 'absolute', bottom: -80, right: 40,
    width: 150, height: 150, borderRadius: 75, opacity: 0.3,
  },
  heroLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    color: 'rgba(45, 30, 30, 0.85)',
    letterSpacing: 0.15,
    marginBottom: 3,
  },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.micro },
  heroCurrency: { fontSize: FontSize.titleLarge, color: '#2D1E1E', marginRight: 6 },
  heroAmount: { fontSize: 32, color: '#2D1E1E' },
  heroProgressSection: {
    marginTop: Spacing.element,
    marginBottom: Spacing.micro,
  },
  heroProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 35, 35, 0.14)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  heroProgressText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#3E2723',
    marginTop: 4,
  },
  heroComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: Spacing.element,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 35, 35, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    gap: 4,
  },
  trendText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    includeFontPadding: false,
  },

  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    marginTop: Spacing.surface,
    marginBottom: 10,
  },
  byCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  donutLeftContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryStackRight: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 8,
  },
  categoryStackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  categoryStackTextWrapper: {
    flex: 1,
  },
  categoryStackName: {
    fontSize: FontSize.body,
    includeFontPadding: false,
  },
  categoryStackSubtext: {
    fontSize: FontSize.bodySmall,
    marginTop: 1,
    includeFontPadding: false,
  },
  chartContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  legendGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.surface,
  },
  legendItem: {
    width: '48%', flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.surface,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.group },
  legendName: { fontSize: FontSize.body },
  legendSubtext: { fontSize: FontSize.bodySmall, marginTop: Spacing.nano },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: Spacing.gutter,
  },
  emptyStateText: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
    marginBottom: Spacing.block,
  },
  emptyStateCta: {
    minWidth: 160,
  },
  expandCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: Spacing.group,
  },
  expandCategoriesText: {
    fontSize: FontSize.bodySmall,
  },
  behavioralInsightsList: {
    marginTop: Spacing.micro,
  },
  disciplineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginTop: Spacing.group,
    paddingHorizontal: Spacing.micro,
  },
  disciplineText: {
    fontSize: FontSize.bodySmall,
    flex: 1,
  },
  quickInsightsList: { marginTop: Spacing.micro },
  quickInsightRow: { flexDirection: 'row', alignItems: 'center' },
  quickInsightTextWrapper: { flex: 1, marginLeft: Spacing.group, justifyContent: 'center' },
  quickInsightLabel: { fontSize: FontSize.caption, marginBottom: 2 },
  quickInsightValue: { fontSize: FontSize.body },
  quickInsightAmountWrapper: { alignItems: 'flex-end', justifyContent: 'center' },
  quickInsightAmount: { fontSize: FontSize.body },
});
