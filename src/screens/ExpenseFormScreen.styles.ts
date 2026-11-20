import { Platform, StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, ControlHeight, LineHeight, LetterSpacing } from '../config/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  currencySymbol: {
    fontSize: 48,
    marginRight: Spacing.micro,
  },
  amountValue: {
    fontSize: 56,
  },
  amountUnderline: {
    height: 1,
    width: 80,
    marginTop: Spacing.element,
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
  formSectionPadding: {
    paddingHorizontal: Spacing.gutter,
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
    marginBottom: Spacing.block,
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
    paddingHorizontal: Spacing.block,
    paddingVertical: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryChipText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
  },
  manageCategoryChip: {
    paddingHorizontal: Spacing.group,
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
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.pill,
  },
  createCategoryBtnText: {
    fontSize: FontSize.bodySmall,
  },
  inputContainer: {
    height: ControlHeight.row,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    justifyContent: 'center',
    marginBottom: Spacing.block,
    marginHorizontal: Spacing.gutter,
  },
  suggestionsScroll: {
    marginBottom: Spacing.block,
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
  inputText: {
    height: '100%',
    fontSize: FontSize.body,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  datePickerButton: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    marginBottom: Spacing.block,
    marginHorizontal: Spacing.gutter,
  },
  datePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerText: {
    marginLeft: Spacing.group,
    fontSize: FontSize.body,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  backdatedNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginHorizontal: Spacing.gutter,
    marginTop: -Spacing.element,
    marginBottom: Spacing.block,
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
  saveButtonKeyboard: {
    marginTop: 0,
    height: ControlHeight.standard,
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
