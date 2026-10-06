import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { ArrowLeft, Check, ChevronRight, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../../config/theme';

/** Small building blocks shared by every Automatic Logging screen (Arthik design language). */

export const ScreenHeader: React.FC<{ title: string; onBack?: () => void; right?: React.ReactNode }> = ({ title, onBack, right }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Go back">
          <ArrowLeft size={28} color={colors.textPrimary} strokeWidth={2.5} />
        </Pressable>
      ) : null}
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'mint' | 'peach' }> = ({ children, style, tone = 'default' }) => {
  const { colors, isDark } = useTheme();
  const bg = tone === 'mint' ? colors.mintGreenSoft : tone === 'peach' ? colors.peachSoft : colors.card;
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }, style]}>
      {children}
    </View>
  );
};

export const SectionLabel: React.FC<{ children: string; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const { colors } = useTheme();
  return <Text style={[styles.sectionLabel, { color: colors.textSecondary }, style as any]}>{children}</Text>;
};

export const Body: React.FC<{ children: React.ReactNode; muted?: boolean; style?: any }> = ({ children, muted, style }) => {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: muted ? colors.textSecondary : colors.textPrimary }, style]}>{children}</Text>;
};

export const Heading: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => {
  const { colors } = useTheme();
  return <Text style={[styles.heading, { color: colors.textPrimary }, style]}>{children}</Text>;
};

export const Bullet: React.FC<{ children: React.ReactNode; tone?: 'ok' | 'no' | 'dot' }> = ({ children, tone = 'dot' }) => {
  const { colors } = useTheme();
  const mark = tone === 'ok' ? '✓' : tone === 'no' ? '✕' : '•';
  const markColor = tone === 'ok' ? colors.mintGreenDark : tone === 'no' ? colors.peachCoral : colors.textSecondary;
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletMark, { color: markColor }]}>{mark}</Text>
      <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{children}</Text>
    </View>
  );
};

/** The reassurance strip that repeats "Discovery = learning, not logging". */
export const Reassurance: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.reassure, { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }]}>
      <Text style={[styles.reassureText, { color: colors.textPrimary }]}>{children}</Text>
    </View>
  );
};

export const StatusDot: React.FC<{ tone: 'live' | 'paused' | 'attention' | 'off'; label: string }> = ({ tone, label }) => {
  const { colors } = useTheme();
  const c = tone === 'live' ? colors.mintGreenDark : tone === 'attention' ? '#F59E0B' : tone === 'paused' ? colors.textSecondary : colors.textMuted;
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.dotLabel, { color: c }]}>{label}</Text>
    </View>
  );
};

export const NavRow: React.FC<{ icon: React.ReactNode; label: string; detail?: string; onPress: () => void; last?: boolean; badge?: number; danger?: boolean }> = ({
  icon, label, detail, onPress, last, badge, danger,
}) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.navRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
      <View style={[styles.navIcon, { backgroundColor: colors.cardSubtle }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.navLabel, { color: danger ? colors.peachCoral : colors.textPrimary }]}>{label}</Text>
        {detail ? <Text style={[styles.navDetail, { color: colors.textSecondary }]}>{detail}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.peachCoral }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
};

export const CheckLine: React.FC<{ ok: boolean; label: string; onFix?: () => void; optional?: boolean }> = ({ ok, label, onFix, optional }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.checkLine}>
      {ok ? <Check size={18} color={colors.mintGreenDark} strokeWidth={3} /> : <AlertTriangle size={18} color="#F59E0B" />}
      <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>
        {label}
        {!ok && optional ? <Text style={{ color: colors.textSecondary }}> (optional)</Text> : null}
      </Text>
      {!ok && onFix ? (
        <Pressable onPress={onFix} hitSlop={8} style={[styles.fixBtn, { backgroundColor: colors.cardSubtle }]}>
          <Text style={[styles.fixText, { color: colors.textPrimary }]}>Fix</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.checkbox, { borderColor: checked ? colors.mintGreenDark : colors.border, backgroundColor: checked ? colors.mintGreenDark : 'transparent' }]}>
      {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3.5} /> : null}
    </View>
  );
};

export const StepDots: React.FC<{ count: number; index: number }> = ({ count, index }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            { backgroundColor: i <= index ? colors.mintGreenDark : colors.border, width: i === index ? 22 : 8 },
          ]}
        />
      ))}
    </View>
  );
};

export const ProgressBar: React.FC<{ value: number }> = ({ value }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.chartTrack }]}>
      <View style={[styles.progressFill, { backgroundColor: colors.mintGreenDark, width: `${Math.max(3, Math.min(100, value * 100))}%` }]} />
    </View>
  );
};

/** "BETA" tag shown wherever Automatic Logging is named. */
export const BetaPill: React.FC<{ small?: boolean }> = ({ small }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.beta, { backgroundColor: colors.peachSoft, borderColor: colors.peachCoral }, small && styles.betaSmall]}>
      <Text style={[styles.betaText, { color: colors.peachCoral }, small && { fontSize: 9 }]}>BETA</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  beta: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'center' },
  betaSmall: { paddingHorizontal: 6, paddingVertical: 1 },
  betaText: { fontSize: FontSize.micro, fontFamily: FontFamily.bold, letterSpacing: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.block, marginBottom: Spacing.element, gap: Spacing.block },
  title: { fontSize: FontSize.titleLarge, lineHeight: LineHeight.titleLarge, fontFamily: FontFamily.bold, flexShrink: 1 },
  card: { borderRadius: BorderRadius.card, padding: Spacing.surface, marginBottom: Spacing.group, elevation: 1 },
  sectionLabel: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: Spacing.element },
  body: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.medium },
  heading: { fontSize: FontSize.titleMedium, lineHeight: LineHeight.titleMedium, fontFamily: FontFamily.bold, marginBottom: Spacing.element },
  bulletRow: { flexDirection: 'row', marginTop: Spacing.element, gap: Spacing.element },
  bulletMark: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold, width: 16, textAlign: 'center' },
  bulletText: { flex: 1, fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.medium },
  reassure: { borderRadius: BorderRadius.input, borderWidth: 1, padding: Spacing.block, marginVertical: Spacing.group },
  reassureText: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.bold },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLabel: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.row, gap: Spacing.group },
  navIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  navDetail: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: Spacing.nano },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontSize: FontSize.micro, fontFamily: FontFamily.bold },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, paddingVertical: Spacing.element },
  checkLabel: { flex: 1, fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  fixBtn: { paddingHorizontal: Spacing.block, paddingVertical: 6, borderRadius: BorderRadius.pill },
  fixText: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  stepDot: { height: 8, borderRadius: 4 },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
});
