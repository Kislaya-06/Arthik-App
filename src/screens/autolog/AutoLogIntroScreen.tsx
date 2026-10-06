import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Zap, Lock } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, LineHeight } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { GradientIconBadge } from '../../components/GradientIconBadge';
import { BetaPill, Body, Bullet, Card } from '../../components/autolog/AutoLogUi';
import { markIntroSeen } from '../../features/autoLog/rollout';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogIntro'>;

/**
 * One-time "what's new" for people who used Arthik before v2.0 (never shown to new users).
 * Nothing turns on by itself: "Turn on" only starts the normal setup.
 */
export const AutoLogIntroScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (userId) markIntroSeen(userId); // shown once, whatever the user picks
  }, [userId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <GradientIconBadge size={72} isDark={isDark}>
            <Zap size={34} color={colors.textPrimary} />
          </GradientIconBadge>
          <View style={styles.newRow}>
            <Text style={[styles.newText, { color: colors.mintGreenDark }]}>NEW IN ARTHIK 2.0</Text>
            <BetaPill />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Automatic Logging</Text>
          <Body muted style={{ textAlign: 'center' }}>
            Stop typing every UPI payment. Arthik can log them for you from bank SMS and payment notifications.
          </Body>
        </View>

        <Card>
          <Bullet tone="ok">Bank SMS and Google Pay / PhonePe / Paytm payments become transactions automatically.</Bullet>
          <Bullet tone="ok">You choose which bank accounts to track.</Bullet>
          <Bullet tone="ok">Not sure? It asks you instead of guessing.</Bullet>
          <Bullet tone="ok">Your old messages are never added as transactions.</Bullet>
          <Bullet tone="ok">Pause or turn it off any time.</Bullet>
        </Card>

        <Card tone="mint">
          <View style={styles.lockRow}>
            <Lock size={16} color={colors.mintGreenDark} />
            <Text style={[styles.lockTitle, { color: colors.textPrimary }]}>Processed on your phone</Text>
          </View>
          <Body muted style={{ marginTop: Spacing.micro }}>
            Your SMS are read on this device only and never uploaded. Personal messages and OTPs are ignored.
          </Body>
        </Card>

        <Body muted style={{ textAlign: 'center', marginTop: Spacing.element }}>
          This is a Beta. Some messages may be missed or misread — you can always correct them.
        </Body>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.block, borderTopColor: colors.borderSubtle }]}>
        <AppButton
          label="Turn on Automatic Logging"
          size="cta"
          icon={<Zap size={18} color={colors.textPrimary} />}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            navigation.replace('AutoLogSetup', { mode: 'first' });
          }}
        />
        <AppButton label="Not now" variant="ghost" style={{ marginTop: Spacing.element }} onPress={() => navigation.goBack()} />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>You can turn it on later from Profile → Automatic Logging.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.section },
  hero: { alignItems: 'center', marginTop: Spacing.section, marginBottom: Spacing.surface },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element, marginTop: Spacing.surface },
  newText: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: 1 },
  title: { fontSize: FontSize.titleLarge, lineHeight: LineHeight.titleLarge, fontFamily: FontFamily.bold, marginTop: Spacing.element, marginBottom: Spacing.element },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element },
  lockTitle: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  footer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.group, borderTopWidth: 1 },
  hint: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, textAlign: 'center', marginTop: Spacing.element },
});
