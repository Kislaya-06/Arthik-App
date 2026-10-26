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
import Sparkles from 'lucide-react-native/icons/sparkles';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

export interface OtaUpdateInfo {
  version?: string;
  title?: string;
  highlights?: string[];
}

export interface OtaUpdateModalProps {
  visible: boolean;
  status?: 'idle' | 'checking' | 'available' | 'upToDate';
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
  status = 'available',
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

  const isUpToDate = status === 'upToDate';
  const title = isUpToDate
    ? "You're Up to Date 🎉"
    : (updateInfo?.title || 'New Update Available 🎉');
  const subtitle = isUpToDate
    ? 'Arthik is running the latest version with all recent improvements.'
    : 'A fresh update is ready to install for the best experience.';
  const highlights = updateInfo?.highlights || [];
  const baseVersion = updateInfo?.version ? `v${updateInfo.version.replace(/^v/, '')}` : 'v2.1.0';
  const versionBadge = isUpToDate ? `${baseVersion} • LATEST` : baseVersion;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={isDownloading ? undefined : onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Top Hero Icon (26 radius for 52x52 circle - AGENTS.md 9.3) */}
          <View style={[styles.heroIcon, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.15)' : colors.mintGreenSoft }]}>
            {isUpToDate ? (
              <CheckCircle2 size={26} color={colors.mintGreenDark} />
            ) : (
              <Sparkles size={24} color={colors.mintGreenDark} />
            )}
          </View>

          {/* Badge chip */}
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft }]}>
            <Text style={[styles.badgeText, { color: colors.mintGreenDark, fontFamily: FontFamily.bold }]}>
              {versionBadge}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            {subtitle}
          </Text>

          {/* Highlights */}
          {highlights.length > 0 && (
            <View style={[styles.highlightsBox, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}>
              <View style={styles.highlightsHeader}>
                {isUpToDate ? (
                  <CheckCircle2 size={12} color={colors.mintGreenDark} />
                ) : (
                  <Sparkles size={12} color={colors.mintGreenDark} />
                )}
                <Text style={[styles.highlightsLabel, { color: colors.mintGreenDark, fontFamily: FontFamily.bold }]}>
                  {isUpToDate ? "WHAT'S IN THIS VERSION" : "WHAT'S NEW"}
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false} bounces={false}>
                {highlights.map((item, idx) => (
                  <View key={idx} style={styles.highlightRow}>
                    <CheckCircle2 size={14} color={colors.mintGreenDark} style={{ marginTop: 2 }} />
                    <Text style={[styles.highlightText, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Error Banner */}
          {Boolean(error) && (
            <View style={[styles.errorBanner, { backgroundColor: colors.peachSoft, borderColor: colors.peachCoral }]}>
              <AlertCircle size={15} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Action Row */}
          {isDownloading ? (
            <View style={[styles.ctaBtn, { backgroundColor: colors.cardSubtle }]}>
              <ActivityIndicator size="small" color={colors.mintGreenDark} />
              <Text style={[{ color: colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.body }]}>
                {downloadProgressText || 'Downloading update...'}
              </Text>
            </View>
          ) : isUpToDate ? (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Pressable
                style={[styles.ctaBtn, { backgroundColor: colors.mintGreen }]}
                onPress={onDismiss}
              >
                <Text style={[styles.ctaText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
                  Got it
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Pressable
                style={[styles.ctaBtn, { backgroundColor: colors.mintGreen }]}
                onPress={error ? (onRetry || onUpdate) : onUpdate}
              >
                {Boolean(error) && <RefreshCw size={16} color={colors.forestGreen} />}
                <Text style={[styles.ctaText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
                  {error ? 'Try Again' : 'Update Now'}
                </Text>
              </Pressable>
              <Pressable style={styles.laterBtn} onPress={onDismiss}>
                <Text style={[{ color: colors.textSecondary, fontFamily: FontFamily.semibold, fontSize: FontSize.bodySmall }]}>
                  {error ? 'Dismiss' : 'Later'}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.cardLarge,
    borderWidth: 1,
    padding: Spacing.gutter,
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.group,
  },
  badge: {
    paddingHorizontal: Spacing.group,
    paddingVertical: Spacing.micro,
    borderRadius: BorderRadius.pill,
    marginBottom: Spacing.element,
  },
  badgeText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: FontSize.cta,
    textAlign: 'center',
    marginBottom: Spacing.nano,
  },
  subtitle: {
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
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.element,
    gap: Spacing.element,
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
  ctaBtn: {
    width: '100%',
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  ctaText: {
    fontSize: FontSize.body,
  },
  laterBtn: {
    width: '100%',
    paddingVertical: Spacing.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
