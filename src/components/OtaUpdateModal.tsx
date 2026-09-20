import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../store/themeStore';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  ControlHeight,
} from '../config/theme';

export interface OtaUpdateInfo {
  version?: string;
  title?: string;
  highlights?: string[];
}

export interface OtaUpdateModalProps {
  visible: boolean;
  updateInfo: OtaUpdateInfo | null;
  isDownloading: boolean;
  downloadProgressText?: string;
  error?: string | null;
  onUpdate: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const OtaUpdateModal: React.FC<OtaUpdateModalProps> = ({
  visible,
  updateInfo,
  isDownloading,
  downloadProgressText,
  error,
  onUpdate,
  onDismiss,
  onRetry,
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const title = updateInfo?.title || 'New Update Available 🎉';
  const highlights = updateInfo?.highlights || [];
  const versionBadge = updateInfo?.version
    ? `v${updateInfo.version.replace(/^v/, '')}`
    : 'OTA PATCH';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDownloading ? undefined : onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Top Hero Icon (width / 2 = 26 for 52x52 circle geometry) */}
          <View
            style={[
              styles.heroIconContainer,
              {
                backgroundColor: isDark
                  ? 'rgba(184, 224, 200, 0.15)'
                  : colors.mintGreenSoft,
              },
            ]}
          >
            <Sparkles size={26} color={colors.mintGreenDark} />
          </View>

          {/* Badge chip */}
          <View
            style={[
              styles.badgeChip,
              {
                backgroundColor: isDark
                  ? 'rgba(184, 224, 200, 0.12)'
                  : colors.mintGreenSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: colors.mintGreenDark, fontFamily: FontFamily.bold },
              ]}
            >
              {versionBadge}
            </Text>
          </View>

          {/* Title and Subtitle */}
          <Text
            style={[
              styles.modalTitle,
              { color: colors.textPrimary, fontFamily: FontFamily.bold },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.modalSubtitle,
              { color: colors.textSecondary, fontFamily: FontFamily.medium },
            ]}
          >
            A fresh update is ready to install for the best experience.
          </Text>

          {/* Highlights / What's New Container */}
          {highlights.length > 0 && (
            <View
              style={[
                styles.highlightsBox,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={styles.highlightsHeader}>
                <Sparkles size={13} color={colors.mintGreenDark} />
                <Text
                  style={[
                    styles.highlightsLabel,
                    {
                      color: colors.mintGreenDark,
                      fontFamily: FontFamily.bold,
                    },
                  ]}
                >
                  WHAT'S NEW
                </Text>
              </View>

              <ScrollView
                style={styles.highlightsScroll}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {highlights.map((item, index) => (
                  <View key={`highlight-${index}`} style={styles.highlightRow}>
                    <CheckCircle2
                      size={14}
                      color={colors.mintGreenDark}
                      style={styles.highlightIcon}
                    />
                    <Text
                      style={[
                        styles.highlightText,
                        {
                          color: colors.textPrimary,
                          fontFamily: FontFamily.medium,
                        },
                      ]}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Error Banner */}
          {error && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.peachSoft,
                  borderColor: colors.peachCoral,
                },
              ]}
            >
              <AlertCircle size={16} color={colors.danger} />
              <Text
                style={[
                  styles.errorText,
                  { color: colors.textPrimary, fontFamily: FontFamily.medium },
                ]}
              >
                {error}
              </Text>
            </View>
          )}

          {/* Action Row */}
          {isDownloading ? (
            <View
              style={[
                styles.downloadingContainer,
                { backgroundColor: colors.cardSubtle },
              ]}
            >
              <ActivityIndicator size="small" color={colors.mintGreenDark} />
              <Text
                style={[
                  styles.downloadingText,
                  { color: colors.textPrimary, fontFamily: FontFamily.bold },
                ]}
              >
                {downloadProgressText || 'Downloading update...'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.actionColumn}>
              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.mintGreen },
                ]}
                onPress={onRetry || onUpdate}
              >
                <RefreshCw size={16} color={colors.forestGreen} />
                <Text
                  style={[
                    styles.primaryBtnText,
                    {
                      color: colors.forestGreen,
                      fontFamily: FontFamily.bold,
                    },
                  ]}
                >
                  Try Again
                </Text>
              </Pressable>
              <Pressable style={styles.laterBtn} onPress={onDismiss}>
                <Text
                  style={[
                    styles.laterBtnText,
                    {
                      color: colors.textSecondary,
                      fontFamily: FontFamily.semibold,
                    },
                  ]}
                >
                  Dismiss
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionColumn}>
              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.mintGreen },
                ]}
                onPress={onUpdate}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    {
                      color: colors.forestGreen,
                      fontFamily: FontFamily.bold,
                    },
                  ]}
                >
                  Update Now
                </Text>
              </Pressable>
              <Pressable style={styles.laterBtn} onPress={onDismiss}>
                <Text
                  style={[
                    styles.laterBtnText,
                    {
                      color: colors.textSecondary,
                      fontFamily: FontFamily.semibold,
                    },
                  ]}
                >
                  Later
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.cardLarge,
    borderWidth: 1,
    padding: Spacing.gutter,
    alignItems: 'center',
  },
  heroIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26, // width / 2 circle geometry (AGENTS.md 9.3)
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.group,
  },
  badgeChip: {
    paddingHorizontal: Spacing.group,
    paddingVertical: Spacing.micro,
    borderRadius: BorderRadius.pill,
    marginBottom: Spacing.element,
  },
  badgeText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: FontSize.cta,
    textAlign: 'center',
    marginBottom: Spacing.nano,
  },
  modalSubtitle: {
    fontSize: FontSize.bodySmall,
    textAlign: 'center',
    marginBottom: Spacing.surface,
  },
  highlightsBox: {
    width: '100%',
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.surface,
  },
  highlightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.group,
    gap: Spacing.micro,
  },
  highlightsLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
  },
  highlightsScroll: {
    maxHeight: 180,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.group,
    gap: Spacing.element,
  },
  highlightIcon: {
    marginTop: 2,
  },
  highlightText: {
    flex: 1,
    fontSize: FontSize.bodySmall,
    lineHeight: 20,
  },
  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.input,
    padding: Spacing.group,
    marginBottom: Spacing.block,
    gap: Spacing.element,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.caption,
  },
  actionColumn: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  primaryBtnText: {
    fontSize: FontSize.body,
  },
  laterBtn: {
    width: '100%',
    paddingVertical: Spacing.row,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.micro,
  },
  laterBtnText: {
    fontSize: FontSize.bodySmall,
  },
  downloadingContainer: {
    width: '100%',
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.group,
  },
  downloadingText: {
    fontSize: FontSize.body,
  },
});
