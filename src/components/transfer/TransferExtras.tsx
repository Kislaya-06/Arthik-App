import React from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { Repeat } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';

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
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { backgroundColor: colors.inputBg }]}>
        <Repeat size={18} color={colors.textSecondary} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Transfer between your own accounts?</Text>
          {p.ruleMatched && p.isSelfTransfer ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>Matches a transfer you asked Arthik to remember</Text>
          ) : (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>Won’t count as income, expense or Gullak</Text>
          )}
        </View>
        <Switch value={p.isSelfTransfer} onValueChange={p.onToggleSelfTransfer} />
      </View>

      {p.isSelfTransfer && !p.ruleMatched ? (
        <View style={[styles.card, { backgroundColor: colors.cardSubtle }]}>
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
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, borderRadius: BorderRadius.input, padding: Spacing.block },
  card: { borderRadius: BorderRadius.input, padding: Spacing.block, gap: Spacing.element },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: 2 },
  optionText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  pills: { flexDirection: 'row', gap: Spacing.group, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingVertical: Spacing.element, paddingHorizontal: Spacing.block },
});
