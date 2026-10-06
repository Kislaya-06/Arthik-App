import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  Linking,
  ScrollView,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Download, Sparkles, ShieldCheck, ArrowRight, PackageCheck, RefreshCw, Zap } from 'lucide-react-native';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  ControlHeight,
} from '../config/theme';
import { useTheme } from '../store/themeStore';
import { DEFAULT_RELEASE_URL, resolveApkUrl } from '../lib/versionCheck';
import { canInstallInApp, downloadApk, openInstaller, openUnknownSourcesSettings } from '../lib/apkInstaller';

interface UpdateRequiredScreenProps {
  currentVersion: string;
  minVersion: string;
  releaseUrl?: string;
  /** v2.0+: direct APK link (server `apk_url`). */
  apkUrl?: string;
  title?: string;
  highlights?: string[];
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'downloading'; fraction: number; receivedMb: number; totalMb: number | null }
  | { kind: 'ready'; localUri: string }
  | { kind: 'error'; message: string };

const DEFAULT_HIGHLIGHTS = [
  'Security fixes and data-integrity improvements',
  'New features and a smoother, faster app',
];

/**
 * Mandatory update gate. There is deliberately NO skip / later / back.
 * Android: download inside the app → Android's own "Install / Update" dialog opens.
 * Fallback (no direct APK link, or anything fails): open the link in the browser.
 */
export const UpdateRequiredScreen: React.FC<UpdateRequiredScreenProps> = ({
  currentVersion,
  minVersion,
  releaseUrl = DEFAULT_RELEASE_URL,
  apkUrl,
  title,
  highlights,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [installerOpened, setInstallerOpened] = useState(false);
  const busy = useRef(false);

  const directApk = resolveApkUrl({ apkUrl, releaseUrl: releaseUrl || DEFAULT_RELEASE_URL });
  const inApp = canInstallInApp() && !!directApk;
  const packageName = Constants.expoConfig?.android?.package || 'com.kislaya_agarwal.arthik';

  // Prevent hardware back button from closing or navigating away
  useEffect(() => {
    const onBackPress = () => true;
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  const openInBrowser = useCallback(async () => {
    const url = directApk || releaseUrl || DEFAULT_RELEASE_URL;
    try {
      const canOpen = await Linking.canOpenURL(url);
      await Linking.openURL(canOpen ? url : DEFAULT_RELEASE_URL);
    } catch {
      await Linking.openURL(DEFAULT_RELEASE_URL);
    }
  }, [directApk, releaseUrl]);

  const install = useCallback(async (localUri: string) => {
    try {
      setInstallerOpened(true);
      await openInstaller(localUri);
    } catch {
      setPhase({ kind: 'error', message: 'Could not open the installer. Allow "Install unknown apps" for Arthik and try again.' });
    }
  }, []);

  const start = useCallback(async () => {
    if (busy.current) return;
    if (!inApp || !directApk) {
      await openInBrowser();
      return;
    }
    busy.current = true;
    setInstallerOpened(false);
    setPhase({ kind: 'downloading', fraction: 0, receivedMb: 0, totalMb: null });
    try {
      const localUri = await downloadApk(directApk, minVersion, (e) => {
        if (e.kind === 'progress') setPhase({ kind: 'downloading', fraction: e.fraction, receivedMb: e.receivedMb, totalMb: e.totalMb });
      });
      setPhase({ kind: 'ready', localUri });
      await install(localUri); // the system "Update app?" dialog appears on its own
    } catch (e: any) {
      setPhase({ kind: 'error', message: e?.message || 'Download failed. Check your internet and try again.' });
    } finally {
      busy.current = false;
    }
  }, [directApk, inApp, install, minVersion, openInBrowser]);

  // Coming back from Android's installer / settings without installing → offer Install again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && phase.kind === 'ready') setInstallerOpened(true);
    });
    return () => sub.remove();
  }, [phase.kind]);

  const displayCurrent = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`;
  const displayRequired = minVersion.startsWith('v') ? minVersion : `v${minVersion || '2.0.0'}`;
  const items = highlights && highlights.length ? highlights : DEFAULT_HIGHLIGHTS;

  let ctaLabel = inApp ? `Download & install ${displayRequired}` : `Download ${displayRequired} APK`;
  let ctaIcon = <Download size={22} color="#1A2B4C" />;
  let ctaAction: () => void = start;
  let ctaDisabled = false;
  if (phase.kind === 'downloading') {
    const pct = Math.round(phase.fraction * 100);
    ctaLabel = phase.totalMb ? `Downloading… ${pct}%` : `Downloading… ${phase.receivedMb.toFixed(1)} MB`;
    ctaIcon = <ActivityIndicator color="#1A2B4C" />;
    ctaDisabled = true;
  } else if (phase.kind === 'ready') {
    ctaLabel = 'Install update';
    ctaIcon = <PackageCheck size={22} color="#1A2B4C" />;
    ctaAction = () => install(phase.localUri);
  } else if (phase.kind === 'error') {
    ctaLabel = 'Try again';
    ctaIcon = <RefreshCw size={22} color="#1A2B4C" />;
  }

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
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.heroIconContainer,
            { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft, borderColor: colors.mintGreen },
          ]}
        >
          <Sparkles size={40} color={colors.mintGreenDark} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{title || 'Update Required'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          A new version of Arthik is required to continue. Your data is safe — it stays in your account.
        </Text>

        <View style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.versionBadgeRow}>
            <View style={[styles.versionPill, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>Current</Text>
              <Text style={[styles.versionValue, { color: colors.textPrimary }]}>{displayCurrent}</Text>
            </View>
            <ArrowRight size={18} color={colors.textSecondary} style={styles.arrowIcon} />
            <View
              style={[
                styles.versionPill,
                { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.15)' : colors.mintGreenSoft, borderColor: colors.mintGreenDark, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.versionLabel, { color: colors.mintGreenDark }]}>Required</Text>
              <Text style={[styles.versionValue, { color: colors.mintGreenDark }]}>{displayRequired}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.highlightsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {items.map((h, i) => (
            <View key={i} style={[styles.highlightItem, i > 0 && { marginTop: Spacing.group }]}>
              <View style={[styles.highlightIconBox, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft }]}>
                {i === 0 ? <Zap size={20} color={colors.mintGreenDark} /> : <ShieldCheck size={20} color={colors.mintGreenDark} />}
              </View>
              <View style={styles.highlightTextCol}>
                <Text style={[styles.highlightDesc, { color: colors.textPrimary }]}>{h}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        {phase.kind === 'downloading' ? (
          <View style={[styles.progressTrack, { backgroundColor: colors.inputBg }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.mintGreenDark, width: `${Math.max(4, Math.round((phase.totalMb ? phase.fraction : 0.15) * 100))}%` },
              ]}
            />
          </View>
        ) : null}

        <Pressable
          disabled={ctaDisabled}
          style={({ pressed }) => [styles.ctaButton, { backgroundColor: colors.mintGreen, opacity: ctaDisabled ? 0.75 : pressed ? 0.88 : 1 }]}
          onPress={ctaAction}
        >
          {ctaIcon}
          <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
        </Pressable>

        {phase.kind === 'error' ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{phase.message}</Text>
        ) : null}

        {phase.kind === 'ready' && installerOpened ? (
          <View style={styles.helpBlock}>
            <Text style={[styles.instructionFooter, { color: colors.textSecondary }]}>
              Didn't see "Update"? Android may first ask you to allow installs from Arthik. Turn on "Allow from this source", come back, and tap Install update.
            </Text>
            <Pressable onPress={() => openUnknownSourcesSettings(packageName).catch(() => Linking.openSettings())} hitSlop={8}>
              <Text style={[styles.linkText, { color: colors.mintGreenDark }]}>Open "Install unknown apps" setting</Text>
            </Pressable>
          </View>
        ) : null}

        {phase.kind === 'error' || !inApp ? (
          <Pressable onPress={openInBrowser} hitSlop={8} style={{ marginTop: Spacing.element }}>
            <Text style={[styles.linkText, { color: colors.mintGreenDark }]}>
              {inApp ? 'Download in browser instead' : 'After downloading, tap the file in your notifications or Downloads to install.'}
            </Text>
          </Pressable>
        ) : phase.kind === 'idle' ? (
          <Text style={[styles.instructionFooter, { color: colors.textSecondary }]}>
            The download happens inside Arthik. When it finishes, Android will ask you to install the update.
          </Text>
        ) : null}
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
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.group,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  errorText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.element,
    paddingHorizontal: Spacing.group,
  },
  helpBlock: {
    alignItems: 'center',
    gap: Spacing.element,
  },
  linkText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
