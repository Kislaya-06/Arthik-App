import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.block,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.block,
  },
  backBtn: {
    marginRight: Spacing.block,
    marginTop: Spacing.micro,
  },
  headerTitle: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },

  // Profile Card (Executive Horizontal Row)
  profileCard: {
    borderRadius: BorderRadius.card,
    marginTop: 0,
    minHeight: 80,
    paddingVertical: 14,
    paddingHorizontal: Spacing.surface,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 28,
    color: '#1A2B4C',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
    justifyContent: 'center',
  },
  fullName: {
    fontSize: FontSize.titleSmall,
    lineHeight: LineHeight.titleSmall,
  },
  accountSubtitle: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    marginTop: 2,
  },
  email: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editProfileText: {
    fontSize: FontSize.caption,
  },

  // Settings Card
  settingsCard: {
    borderRadius: BorderRadius.card,
    marginTop: Spacing.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.surface,
    paddingTop: Spacing.surface,
    paddingBottom: Spacing.element,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.block,
    borderBottomWidth: 1,
  },
  lastSettingRow: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.group,
  },
  settingLabel: {
    flex: 1,
    fontSize: FontSize.body,
  },
  versionText: {
    fontSize: FontSize.bodySmall,
  },

  // Theme Selector Tokens
  themeSettingContainer: {
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.block,
    borderBottomWidth: 1,
  },
  themeSettingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.group,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.element,
    marginTop: 2,
  },
  themeOptionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    position: 'relative',
  },
  themeOptionBtnAmoled: {
    position: 'relative',
  },
  amoledBadgeContainer: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  amoledBadgeText: {
    color: '#000000',
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
  },
  themeOptionLabel: {
    fontSize: FontSize.bodySmall,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.surface,
    marginTop: Spacing.gutter,
    gap: Spacing.element,
  },
  logoutText: {
    fontSize: FontSize.body,
  },
  // Edit Profile Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.gutter,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: FontSize.titleMedium,
    marginBottom: Spacing.surface,
  },
  modalLabel: {
    fontSize: FontSize.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.element,
    marginTop: Spacing.group,
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.row,
    fontSize: FontSize.body,
    borderWidth: 1,
  },
  modalCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.element,
    minHeight: 18,
  },
  modalErrorText: {
    fontSize: FontSize.caption,
    flex: 1,
    marginRight: Spacing.element,
  },
  modalCharCount: {
    fontSize: FontSize.caption,
  },
  modalEmailSection: {
    marginTop: Spacing.element,
  },
  modalEmailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.row,
    borderWidth: 1,
  },
  modalEmailText: {
    flex: 1,
    fontSize: FontSize.bodySmall,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.group,
    marginTop: Spacing.gutter,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.row,
  },
  modalCancelText: {
    fontSize: FontSize.body,
  },
  modalSaveText: {
    color: '#1A2B4C',
    fontSize: FontSize.body,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.row,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 40,
    gap: Spacing.element,
  },
  deleteAccountText: {
    fontSize: FontSize.body,
  },
  deleteWarningIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24, // Circle geometry: width / 2
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.element,
  },
  deleteModalTitle: {
    fontSize: FontSize.titleMedium,
    marginBottom: Spacing.nano,
  },
  deleteModalDesc: {
    fontSize: FontSize.bodySmall,
    lineHeight: 18,
    marginBottom: Spacing.element,
  },
  deleteEmailBadge: {
    paddingHorizontal: Spacing.element,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: Spacing.element,
  },
  deleteEmailBadgeText: {
    fontSize: FontSize.bodySmall,
  },
  deleteErrorText: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.micro,
  },

  // Smart Budget & Gullak Card (Executive Horizontal Row matching Profile Card)
  budgetCard: {
    borderRadius: BorderRadius.card,
    marginTop: Spacing.surface,
    minHeight: 80,
    paddingVertical: 14,
    paddingHorizontal: Spacing.surface,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  budgetPressableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.element,
  },
  budgetIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    justifyContent: 'center',
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetModeTitleText: {
    fontSize: FontSize.titleSmall,
    lineHeight: LineHeight.titleSmall,
    flexShrink: 1,
  },
  budgetHelpBadge: {
    marginLeft: 5,
  },
  budgetModeSubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    marginTop: 3,
  },
  pauseIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24, // Circle geometry: width / 2
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.element,
  },
  pauseModalDesc: {
    fontSize: FontSize.bodySmall,
    lineHeight: 20,
    marginBottom: Spacing.element,
  },
});
