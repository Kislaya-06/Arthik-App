import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight, LetterSpacing } from '../../config/theme';

export const styles = StyleSheet.create({
  modalContainer: {
    height: '86%',
    maxHeight: '92%',
  },
  modalContent: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: Spacing.block,
  },
  // ── Split-row Receipt Summary Card ──
  summaryCard: {
    borderRadius: BorderRadius.input,
    padding: Spacing.group,
    marginBottom: Spacing.group,
  },
  summarySplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeftCol: {
    flex: 1,
    marginRight: Spacing.element,
  },
  summaryAmount: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  summaryMerchant: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    marginTop: 2,
  },
  summaryRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  accountPill: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    maxWidth: 150,
  },
  accountPillText: {
    fontSize: FontSize.caption - 1,
    fontFamily: FontFamily.bold,
  },
  summaryDateText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: 4,
  },
  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.micro,
    alignSelf: 'flex-start',
  },
  discoveryBadgeText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryQuoteBox: {
    borderRadius: 8,
    paddingHorizontal: Spacing.element,
    paddingVertical: 5,
    marginTop: 8,
  },
  summaryQuoteText: {
    fontSize: FontSize.caption - 1,
    fontFamily: FontFamily.medium,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.group,
  },
  categorySection: {
    marginBottom: Spacing.group,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.element,
  },
  label: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: LetterSpacing.label,
    textTransform: 'uppercase',
    marginBottom: Spacing.element,
  },
  chosenLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  // ── Horizontal category scroll & fade styles ──
  categoryScrollContainer: {
    position: 'relative',
    marginHorizontal: -Spacing.gutter,
  },
  categoryList: {
    flexDirection: 'row',
    gap: Spacing.element,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: 2,
  },
  categoryFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
  categoryFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingLeft: Spacing.element,
    paddingRight: Spacing.block,
    borderWidth: 1,
    overflow: 'hidden',
    height: 42,
  },
  // Same 24dp category badge slot as the Add Transaction chips (concentric: (42 - 2 - 24) / 2 = Spacing.element).
  categoryChipIconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
    includeFontPadding: false,
  },
  // ── 48px Uniform Stadium Pills ──
  rememberPill: {
    height: ControlHeight.standard,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.block,
    gap: Spacing.element,
    marginBottom: Spacing.group,
  },
  rememberText: {
    flex: 1,
    fontSize: FontSize.bodySmall,
    includeFontPadding: false,
  },
  actionPillsGroup: {
    gap: Spacing.element,
    marginBottom: Spacing.group,
  },
  owingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: BorderRadius.input,
    padding: Spacing.group,
    minHeight: 48,
  },
  owingTextCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: Spacing.element + 2,
    marginRight: Spacing.element,
    gap: 3,
    alignItems: 'flex-start',
  },
  owingName: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    maxWidth: '100%',
  },
  owingOwed: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    flexShrink: 0,
  },
  likelyTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  likelyTagText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.2,
  },
  settleNote: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
    textAlign: 'center',
  },
  dimmedSection: {
    opacity: 0.4,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    height: ControlHeight.standard,
  },
  rupee: {
    fontSize: FontSize.titleSmall,
    fontFamily: FontFamily.bold,
    marginRight: Spacing.element,
  },
  amountInput: {
    flex: 1,
    fontSize: FontSize.titleSmall,
    fontFamily: FontFamily.bold,
  },
  footerCol: {
    gap: Spacing.group,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.block,
    paddingTop: Spacing.element,
    paddingBottom: Spacing.nano,
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.element,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.semibold,
  },
  dotSeparator: {
    fontSize: FontSize.bodySmall,
  },
  error: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
    marginBottom: Spacing.micro,
    textAlign: 'center',
  },
  text: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall + 2,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.element,
  },
});
