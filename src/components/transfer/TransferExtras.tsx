import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Repeat } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../../config/theme';
import { AnimatedToggle } from '../AnimatedToggle';

export interface TransferExtrasProps {
  isSelfTransfer: boolean;
  onToggleSelfTransfer: (on: boolean) => void;
  rememberMode: 'always' | 'once';
  onRememberMode: (m: 'always' | 'once') => void;
  canRemember: boolean;
  ruleMatched: boolean;
}

/** Optional extra under the form: mark a transaction as a transfer between the user's own accounts (TXN-003). */
export const TransferExtras: React.FC<TransferExtrasProps> = (p) => {
  const { colors, isDark } = useTheme();
  const activeColor = isDark ? colors.mintGreen : colors.forestGreen;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => p.onToggleSelfTransfer(!p.isSelfTransfer)}
        style={[
          styles.pillTrigger,
          {
            backgroundColor: colors.inputBg,
            borderColor: p.isSelfTransfer ? activeColor : colors.borderSubtle,
          },
        ]}
        accessibilityRole="switch"
        accessibilityState={{ checked: p.isSelfTransfer }}
        accessibilityLabel="Transfer between your own accounts"
      >
        <View style={styles.pillLeft}>
          <Repeat size={18} color={p.isSelfTransfer ? activeColor : colors.textSecondary} />
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Transfer between your own accounts?</Text>
            {p.ruleMatched && p.isSelfTransfer ? (
              <Text style={[styles.sub, { color: colors.textSecondary }]}>Matches a transfer you asked Arthik to remember</Text>
            ) : (
              <Text style={[styles.sub, { color: colors.textSecondary }]}>Won’t count as income, expense or Gullak</Text>
            )}
          </View>
        </View>
        <AnimatedToggle
          value={p.isSelfTransfer}
          onValueChange={p.onToggleSelfTransfer}
          onColor={activeColor}
        />
      </Pressable>

      {p.isSelfTransfer && !p.ruleMatched ? (
        <View style={[styles.card, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Remember this for future matching transfers?</Text>
          <View style={styles.pills}>
            {(['always', 'once'] as const).map((m) => {
              const disabled = m === 'always' && !p.canRemember;
              const active = p.rememberMode === m && !disabled;
              return (
                <Pressable
                  key={m}
                  disabled={disabled}
                  onPress={() => p.onRememberMode(m)}
                  style={[styles.pill, { borderColor: active ? colors.mintGreenDark : colors.borderSubtle, opacity: disabled ? 0.45 : 1 }]}
                >
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{m === 'always' ? 'Always remember' : 'Only this transaction'}</Text>
                </Pressable>
              );
            })}
          </View>
          {!p.canRemember ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              Add a descriptive note (e.g. “HDFC to SBI savings”) to remember it. Arthik never remembers by amount alone.
            </Text>
          ) : (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>Matches only transfers with the same note.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.group, marginTop: Spacing.block },
  pillTrigger: {
    minHeight: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: 10,
    borderWidth: 1,
  },
  pillLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    marginRight: Spacing.element,
  },
  textWrap: {
    flex: 1,
  },
  card: {
    borderRadius: BorderRadius.card,
    padding: Spacing.block,
    gap: Spacing.element,
    borderWidth: 1,
  },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.micro, fontFamily: FontFamily.medium, marginTop: 2 },
  optionText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  pills: { flexDirection: 'row', gap: Spacing.group, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingVertical: Spacing.element, paddingHorizontal: Spacing.block },
});
