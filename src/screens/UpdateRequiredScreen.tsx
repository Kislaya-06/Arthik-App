import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  Linking,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react-native';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  ControlHeight,
} from '../config/theme';
import { useTheme } from '../store/themeStore';
import { DEFAULT_RELEASE_URL } from '../lib/versionCheck';

interface UpdateRequiredScreenProps {
  currentVersion: string;
  minVersion: string;
  releaseUrl?: string;
}

export const UpdateRequiredScreen: React.FC<UpdateRequiredScreenProps> = ({
  currentVersion,
  minVersion,
  releaseUrl = DEFAULT_RELEASE_URL,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // Prevent hardware back button from closing or navigating away
  useEffect(() => {
    const onBackPress = () => true;
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  const handleDownload = async () => {
    try {
      const url = releaseUrl || DEFAULT_RELEASE_URL;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(DEFAULT_RELEASE_URL);
      }
    } catch {
      await Linking.openURL(DEFAULT_RELEASE_URL);
    }
  };

  const displayCurrent = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`;
  const displayRequired = minVersion.startsWith('v') ? minVersion : `v${minVersion || '1.2.4'}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.section,
          paddingBottom: Math.max(insets.bottom, Spacing.gutter),
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Icon Container (width / 2 geometry for circle) */}
        <View
          style={[
            styles.heroIconContainer,
            {
              backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft,
              borderColor: colors.mintGreen,
            },
          ]}
        >
          <Sparkles size={40} color={colors.mintGreenDark} />
        </View>

        {/* Title and Subtitle */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Update Required
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          A critical update is required to continue using Arthik. Your current version has been deprecated.
        </Text>

        {/* Version Transition Card */}
        <View
          style={[
            styles.versionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.versionBadgeRow}>
            <View
              style={[
                styles.versionPill,
                {
                  backgroundColor: colors.inputBg,
                },
              ]}
            >
              <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>
                Current
              </Text>
              <Text style={[styles.versionValue, { color: colors.textPrimary }]}>
                {displayCurrent}
              </Text>
            </View>

            <ArrowRight size={18} color={colors.textSecondary} style={styles.arrowIcon} />

            <View
              style={[
                styles.versionPill,
                {
                  backgroundColor: isDark ? 'rgba(184, 224, 200, 0.15)' : colors.mintGreenSoft,
                  borderColor: colors.mintGreenDark,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.versionLabel, { color: colors.mintGreenDark }]}>
                Required
              </Text>
              <Text style={[styles.versionValue, { color: colors.mintGreenDark }]}>
                {displayRequired}
              </Text>
            </View>
          </View>
        </View>

        {/* Highlights Card */}
        <View
          style={[
            styles.highlightsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.highlightItem}>
            <View
              style={[
                styles.highlightIconBox,
                { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft },
              ]}
            >
              <ShieldCheck size={20} color={colors.mintGreenDark} />
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={[styles.highlightTitle, { color: colors.textPrimary }]}>
                Security & Data Integrity
              </Text>
              <Text style={[styles.highlightDesc, { color: colors.textSecondary }]}>
                Includes essential security updates and database constraints.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.spacer} />

        {/* Primary CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: colors.mintGreen,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          onPress={handleDownload}
        >
          <Download size={22} color="#1A2B4C" />
          <Text style={styles.ctaButtonText}>
            Download {displayRequired} APK
          </Text>
        </Pressable>

        {/* Instruction Footer */}
        <Text style={[styles.instructionFooter, { color: colors.textSecondary }]}>
          After downloading the APK from GitHub Releases, tap the notification or file in your Downloads folder to install.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.gutter,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.section,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40, // width / 2 circle geometry
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.surface,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.screenTitle,
    textAlign: 'center',
    marginBottom: Spacing.element,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: Spacing.element,
    marginBottom: Spacing.section,
  },
  versionCard: {
    width: '100%',
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionPill: {
    flex: 1,
    paddingVertical: Spacing.element,
    paddingHorizontal: Spacing.group,
    borderRadius: BorderRadius.input,
    alignItems: 'center',
  },
  arrowIcon: {
    marginHorizontal: Spacing.element,
  },
  versionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.nano,
  },
  versionValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
  },
  highlightsCard: {
    width: '100%',
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.section,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22, // circle geometry
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.group,
  },
  highlightTextCol: {
    flex: 1,
  },
  highlightTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.body,
    marginBottom: Spacing.nano,
  },
  highlightDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.bodySmall,
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.block,
  },
  ctaButton: {
    width: '100%',
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
    marginBottom: Spacing.group,
  },
  ctaButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.cta,
    color: '#1A2B4C',
  },
  instructionFooter: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.group,
  },
});
