import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Repeat from 'lucide-react-native/icons/repeat';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';
import { AnimatedToggle } from '../AnimatedToggle';
import { FormGroup, FormRow } from '../ui/FormGroup';
import { PressableOpacity } from '../ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';

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

  // Its own one-row card under the details card: the explanation is the row's subtitle.
  return (
    <FormGroup>
      <FormRow
        icon={Repeat}
        iconColor={p.isSelfTransfer ? activeColor : undefined}
        title="Between my own accounts"
        subtitle={
          p.ruleMatched && p.isSelfTransfer
            ? 'Matches a transfer you asked Arthik to remember'
            : 'Won’t count as income, expense or Gullak'
        }
        onPress={() => p.onToggleSelfTransfer(!p.isSelfTransfer)}
        accessibilityRole="switch"
        accessibilityState={{ checked: p.isSelfTransfer }}
        accessibilityLabel="Transfer between your own accounts"
        right={
          <AnimatedToggle
            value={p.isSelfTransfer}
            onValueChange={p.onToggleSelfTransfer}
            onColor={activeColor}
          />
        }
      >
      {p.isSelfTransfer && !p.ruleMatched ? (
        <View style={[styles.card, { backgroundColor: colors.cardSubtle }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Remember this for future matching transfers?</Text>
          <View style={styles.pills}>
            {(['always', 'once'] as const).map((m) => {
              const disabled = m === 'always' && !p.canRemember;
              const active = p.rememberMode === m && !disabled;
              return (
                <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                  key={m}
                  disabled={disabled}
                  onPress={() => p.onRememberMode(m)}
                  style={[styles.pill, { borderColor: active ? colors.mintGreenDark : colors.borderSubtle, opacity: disabled ? 0.45 : 1 }]}
                >
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{m === 'always' ? 'Always remember' : 'Only this transaction'}</Text>
                </PressableOpacity>
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
      </FormRow>
    </FormGroup>
  );
};

const styles = StyleSheet.create({
  // Inside the row: a soft panel, no border of its own (no card inside a card).
  card: {
    borderRadius: BorderRadius.input,
    padding: Spacing.block,
    gap: Spacing.element,
  },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.micro, fontFamily: FontFamily.medium, marginTop: 2 },
  optionText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  pills: { flexDirection: 'row', gap: Spacing.group, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingVertical: Spacing.element, paddingHorizontal: Spacing.block },
});
