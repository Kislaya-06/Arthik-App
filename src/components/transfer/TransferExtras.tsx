import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Repeat from 'lucide-react-native/icons/repeat';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight } from '../../config/theme';
import { AnimatedToggle } from '../AnimatedToggle';
import { FormRow, FORM_ROW_ICON } from '../ui/FormGroup';
import { PressableOpacity } from '../ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';

export interface TransferExtrasProps {
  isSelfTransfer: boolean;
  onToggleSelfTransfer: (on: boolean) => void;
  rememberMode: 'always' | 'once';
  onRememberMode: (m: 'always' | 'once') => void;
  canRemember: boolean;
  ruleMatched: boolean;
  /** "Yes, always" was picked but there is no descriptive note yet: take the user to the note field. */
  onNeedNote?: () => void;
}

/**
 * Row of the Add Transaction details card: mark a transaction as a transfer between the user's own accounts (TXN-003).
 * One line like every other row; what it means (and the remember choice) opens inside the row once it is on.
 */
export const TransferExtras: React.FC<TransferExtrasProps> = (p) => {
  const { colors, isDark } = useTheme();
  const activeColor = isDark ? colors.mintGreen : colors.forestGreen;

  return (
    <FormRow
      icon={Repeat}
      iconColor={p.isSelfTransfer ? activeColor : undefined}
      title="Between my own accounts"
      onPress={() => p.onToggleSelfTransfer(!p.isSelfTransfer)}
      accessibilityRole="switch"
      accessibilityState={{ checked: p.isSelfTransfer }}
      accessibilityLabel="Transfer between your own accounts. Won’t count as income, expense or Gullak"
      right={
        <AnimatedToggle
          value={p.isSelfTransfer}
          onValueChange={p.onToggleSelfTransfer}
          onColor={activeColor}
        />
      }
    >
      {p.isSelfTransfer ? (
        <>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            {p.ruleMatched
              ? 'Matches a transfer you asked Arthik to remember'
              : 'Won’t count as income, expense or Gullak'}
          </Text>

          {!p.ruleMatched ? (
            <View style={[styles.panel, { backgroundColor: colors.cardSubtle }]}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Remember this for future matching transfers?</Text>
              <View style={styles.pills}>
                {(['always', 'once'] as const).map((m) => {
                  // Never a dead button: "Yes, always" can always be picked. Without a descriptive note it is
                  // only remembered once a note is written (TXN-003: never by amount alone), and we say so below.
                  const active = p.rememberMode === m;
                  return (
                    <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                      key={m}
                      onPress={() => {
                        p.onRememberMode(m);
                        if (m === 'always' && !p.canRemember) p.onNeedNote?.();
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: active ? colors.mintGreen : 'transparent',
                          borderColor: active ? colors.mintGreen : colors.border,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                        style={[
                          styles.optionText,
                          {
                            color: active ? colors.forestGreen : colors.textPrimary,
                            fontFamily: active ? FontFamily.bold : FontFamily.semibold,
                          },
                        ]}
                      >
                        {m === 'always' ? 'Yes, always' : 'Only this time'}
                      </Text>
                    </PressableOpacity>
                  );
                })}
              </View>
              <Text
                style={[
                  styles.sub,
                  { color: p.rememberMode === 'always' && !p.canRemember ? colors.coralText : colors.textSecondary },
                ]}
              >
                {p.canRemember
                  ? 'Matches only transfers with the same note.'
                  : p.rememberMode === 'always'
                  ? 'Add a note below, like “HDFC to SBI savings”, so Arthik can remember it.'
                  : 'To remember it, add a note like “HDFC to SBI savings”. Arthik never remembers by amount alone.'}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </FormRow>
  );
};

const styles = StyleSheet.create({
  // Starts under the row title, like a subtitle that appears once the switch is on.
  helper: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
    marginTop: -Spacing.element,
    paddingLeft: FORM_ROW_ICON + Spacing.group,
  },
  // Inside the row: a soft panel, no border of its own (no card inside a card).
  panel: {
    borderRadius: BorderRadius.input,
    padding: Spacing.block,
    gap: Spacing.group,
  },
  title: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, lineHeight: LineHeight.caption, fontFamily: FontFamily.medium },
  optionText: { fontSize: FontSize.bodySmall, textAlign: 'center' },
  // Two answers side by side, equal width (they wrapped onto two lines before).
  pills: { flexDirection: 'row', gap: Spacing.element },
  pill: {
    flex: 1,
    height: ControlHeight.compact,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.block,
  },
});
