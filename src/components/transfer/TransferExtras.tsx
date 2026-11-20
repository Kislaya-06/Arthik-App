import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Repeat from 'lucide-react-native/icons/repeat';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight, LetterSpacing } from '../../config/theme';
import { AnimatedToggle } from '../AnimatedToggle';
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

  return (
    <View style={styles.wrap}>
      {/* Same anatomy as every other form field: label, 56dp row, helper line. */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>TRANSFER</Text>
      <View style={styles.field}>
        <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
          onPress={() => p.onToggleSelfTransfer(!p.isSelfTransfer)}
          style={[styles.row, { backgroundColor: colors.inputBg }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: p.isSelfTransfer }}
          accessibilityLabel="Transfer between your own accounts"
        >
          <View style={styles.rowLeft}>
            <Repeat size={18} color={p.isSelfTransfer ? activeColor : colors.textSecondary} />
            <Text
              style={[styles.rowTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              Between my own accounts
            </Text>
          </View>
          <AnimatedToggle
            value={p.isSelfTransfer}
            onValueChange={p.onToggleSelfTransfer}
            onColor={activeColor}
          />
        </PressableOpacity>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          {p.ruleMatched && p.isSelfTransfer
            ? 'Matches a transfer you asked Arthik to remember'
            : 'Won’t count as income, expense or Gullak'}
        </Text>
      </View>

      {p.isSelfTransfer && !p.ruleMatched ? (
        <View style={[styles.card, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.group },
  label: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: LetterSpacing.label, textTransform: 'uppercase' },
  field: { gap: Spacing.element },
  row: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    marginRight: Spacing.element,
  },
  rowTitle: { flexShrink: 1, fontSize: FontSize.body, fontFamily: FontFamily.medium, includeFontPadding: false },
  helper: { fontSize: FontSize.caption, lineHeight: LineHeight.caption, fontFamily: FontFamily.medium, paddingHorizontal: Spacing.surface },
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
