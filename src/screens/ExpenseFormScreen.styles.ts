import { Platform, StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight, LetterSpacing } from '../config/theme';

/** Category badge inside a chip (circle geometry, §9.3). Chip inset = Spacing.element on every side, so the badge sits concentric. */
export const CATEGORY_CHIP_BADGE = 24;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Mode switch: full width, 56dp, one step bigger than the 48dp choices below it.
  typeToggleWrapper: {
    paddingHorizontal: Spacing.gutter,
    marginTop: 0,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: Spacing.block,
  },
  expressionText: {
    fontSize: FontSize.body,
    marginBottom: Spacing.nano,
    textAlign: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Hero amount: the ₹ is smaller and lighter than the digits, so the number leads.
  currencySymbol: {
    fontSize: 40,
    marginRight: Spacing.micro,
  },
  amountValue: {
    fontSize: 56,
  },
  bodyWrapper: {
    flex: 1,
  },
  scrollSection: {
    flex: 1,
    marginTop: Spacing.surface,
  },
  scrollContent: {
    paddingBottom: Spacing.section,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.label,
    textTransform: 'uppercase',
    marginBottom: Spacing.group,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.group,
    paddingHorizontal: Spacing.gutter,
  },
  sectionLabelNoMargin: {
    marginBottom: 0,
  },
  noteCounterText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
  },

  categoryScrollContainer: {
    position: 'relative',
    minHeight: 44,
    marginBottom: Spacing.gutter,
  },
  categoryList: {
    flexDirection: 'row',
    gap: Spacing.group,
    paddingHorizontal: Spacing.gutter,
  },
  categoryFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 10,
  },
  categoryFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingLeft: Spacing.element,
    paddingRight: Spacing.block,
    paddingVertical: Spacing.element,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryChipIconSlot: {
    width: CATEGORY_CHIP_BADGE,
    height: CATEGORY_CHIP_BADGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
  },
  manageCategoryChip: {
    paddingLeft: Spacing.group,
    paddingRight: Spacing.group,
    justifyContent: 'center',
  },
  emptyCategoriesContainer: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.block,
    marginHorizontal: Spacing.gutter,
  },
  emptyCategoriesText: {
    fontSize: FontSize.bodySmall,
    textAlign: 'center',
  },
  createCategoryBtn: {
    height: ControlHeight.compact,
    justifyContent: 'center',
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.pill,
  },
  createCategoryBtnText: {
    fontSize: FontSize.bodySmall,
  },
  // A primary choice (Paid via): caption, then the full-width control; same gap to the next group as Category.
  choiceSection: {
    paddingHorizontal: Spacing.gutter,
    marginBottom: Spacing.gutter,
  },
  // ── Details card rows ──
  // The value keeps its natural width on one line; the title gives way first.
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.micro,
  },
  rowValueText: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontFamily: FontFamily.medium,
  },
  noteInput: {
    flex: 1,
    minHeight: 40,
    fontSize: FontSize.body,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  suggestionsScroll: {
    marginTop: Spacing.group,
  },
  suggestionsList: {
    flexDirection: 'row',
    gap: Spacing.element,
    paddingHorizontal: Spacing.gutter,
  },
  suggestionChip: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: FontSize.bodySmall,
  },
  backdatedNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginHorizontal: Spacing.gutter,
    marginTop: Spacing.group,
  },
  backdatedNoticeLeftIcon: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdatedNoticeTextWrap: {
    flex: 1,
  },
  backdatedNoticeTitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    marginBottom: 2,
  },
  backdatedNoticeDesc: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
  },
  bottomSection: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.surface,
    paddingTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  keypadGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    borderRadius: BorderRadius.pill,
    height: ControlHeight.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  saveButtonEnabled: {
    ...Platform.select({
      ios: {
        shadowColor: '#B8E0C8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  saveButtonDisabled: {
    borderWidth: 1,
  },
  saveButtonText: {
    fontSize: FontSize.titleSmall,
    lineHeight: LineHeight.titleSmall,
    letterSpacing: 0.3,
  },
  keypadHandleBar: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginBottom: Spacing.micro,
  },
  keypadHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
