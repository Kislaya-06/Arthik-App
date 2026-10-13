import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.cardLarge,
    borderWidth: 1,
    padding: Spacing.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.group,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.element,
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FontSize.titleMedium,
    fontFamily: FontFamily.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    gap: 4,
  },
  streakPillText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.group,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.element,
  },
  dayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.micro,
  },
  dayOfWeekText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.group,
  },
  dayCellWrapper: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  connectionLineLeft: {
    position: 'absolute',
    top: '50%',
    marginTop: -1.5,
    height: 3,
    left: 0,
    right: '50%',
    zIndex: 0,
  },
  connectionLineRight: {
    position: 'absolute',
    top: '50%',
    marginTop: -1.5,
    height: 3,
    left: '50%',
    right: 0,
    zIndex: 0,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dayText: {
    fontSize: 13,
  },
  tooltipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.group,
    marginBottom: 14,
    gap: Spacing.element,
  },
  tooltipIconWrap: {
    marginTop: 1,
  },
  tooltipTextWrap: {
    flex: 1,
  },
  tooltipTitle: {
    fontSize: FontSize.caption,
    lineHeight: 17,
    fontFamily: FontFamily.semibold,
  },
  tooltipClose: {
    padding: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    gap: Spacing.group,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.pill,
  },
  legendRing: {
    width: 9,
    height: 9,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
  },
  legendText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
  },
  legendDivider: {
    width: 3,
    height: 3,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
  },
});
