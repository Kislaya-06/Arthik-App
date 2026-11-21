import React, { useRef } from 'react';
import { View, Text, StyleSheet, TextInput, LayoutChangeEvent } from 'react-native';
import Users from 'lucide-react-native/icons/users';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import User from 'lucide-react-native/icons/user';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { MAX_PERSON_NAME, personKey } from '../../lib/splitLedger';
import { AnimatedToggle } from '../AnimatedToggle';
import type { SplitFormState } from '../../hooks/useExpenseForm';
import { PressableOpacity } from '../ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';
import { FormRow } from '../ui/FormGroup';

export interface SplitExtrasProps {
  split: SplitFormState;
  /** A name or share field got focus (the keyboard is coming): scroll it into view. */
  onFieldFocus?: (relativeY?: number) => void;
  /** The switch turned the split on: scroll the editor into view (no keyboard). */
  onReveal?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * Split expense row of the Add Transaction details card (SPL-001):
 * - a switch row ("Split with friends")
 * - once on, the editor opens inside the same row: people with custom or equal shares
 * The screen renders it only while `split.visible`, so the card never gets an empty row.
 */
export const SplitExtras: React.FC<SplitExtrasProps> = ({ split, onFieldFocus, onReveal, onLayout }) => {
  const { colors, isDark } = useTheme();
  const rowOffsets = useRef<Record<number, number>>({});
  if (!split.visible) return null;

  const existingKeys = new Set(split.members.map((m) => personKey(m.person)));
  const suggestions = split.knownNames
    .filter((name) => !existingKeys.has(personKey(name)))
    .slice(0, 4);

  const activeColor = isDark ? colors.mintGreen : colors.forestGreen;
  const toggle = (on: boolean) => {
    if (on) onReveal?.();
    split.setOn(on);
  };

  return (
    <FormRow
      icon={Users}
      iconColor={split.on ? activeColor : undefined}
      title="Split with friends"
      onPress={() => toggle(!split.on)}
      onLayout={onLayout}
      accessibilityRole="switch"
      accessibilityState={{ checked: split.on }}
      accessibilityLabel="Split this expense"
      right={<AnimatedToggle value={split.on} onValueChange={toggle} onColor={activeColor} />}
    >
      {/* ── Split editor (opens inside the row) ── */}
      {split.on && (
        <View style={styles.editor}>
          {/* Header Row: Title + Split Equally Action */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
              WHO SHARES THIS?
            </Text>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              onPress={split.splitEqually}
              hitSlop={8}
              style={[styles.equalBtn, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Split equally"
            >
              <Text style={[styles.equalBtnText, { color: activeColor, fontFamily: FontFamily.bold }]}>
                Split equally
              </Text>
            </PressableOpacity>
          </View>

          {/* Members List */}
          <View style={styles.memberList}>
            {split.members.map((member, index) => (
              <View
                key={member.id || index}
                style={styles.memberRow}
                onLayout={(e) => {
                  rowOffsets.current[index] = e.nativeEvent.layout.y;
                }}
              >
                {/* Person Name Input */}
                <View style={[styles.inputBox, styles.nameBox, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}>
                  <User size={15} color={colors.textMuted} style={styles.iconPrefix} />
                  <TextInput
                    value={member.person}
                    onChangeText={(text) => split.updateMemberName(index, text)}
                    onFocus={() => onFieldFocus?.(rowOffsets.current[index] ?? index * 56)}
                    maxLength={MAX_PERSON_NAME}
                    placeholder={`Person ${index + 1}`}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    style={[styles.input, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}
                  />
                </View>

                {/* Amount Input */}
                <View style={[styles.inputBox, styles.amountBox, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.rupeePrefix, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>₹</Text>
                  <TextInput
                    value={member.shareText}
                    onChangeText={(text) => split.updateMemberShareText(index, text)}
                    onFocus={() => onFieldFocus?.(rowOffsets.current[index] ?? index * 56)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.amountInput, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
                  />
                </View>

                {/* Remove button */}
                {split.members.length > 1 && (
                  <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                    onPress={() => split.removeMember(index)}
                    hitSlop={8}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove person ${index + 1}`}
                  >
                    <X size={16} color={colors.textMuted} />
                  </PressableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Bottom Actions: + Add Person & Quick Suggestions */}
          <View style={styles.actionsRow}>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              onPress={() => {
                split.addMember();
                const nextIndex = split.members.length;
                const targetOffset = (rowOffsets.current[nextIndex - 1] ?? nextIndex * 56) + 56;
                setTimeout(() => {
                  onFieldFocus?.(targetOffset);
                }, 50);
              }}
              style={[styles.addPersonBtn, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Add person"
            >
              <Plus size={14} color={colors.textPrimary} />
              <Text style={[styles.addPersonText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                Add Person
              </Text>
            </PressableOpacity>

            {suggestions.map((name) => (
              <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                key={name}
                onPress={() => {
                  split.addMember(name);
                  const nextIndex = split.members.length;
                  const targetOffset = (rowOffsets.current[nextIndex - 1] ?? nextIndex * 56) + 56;
                  setTimeout(() => {
                    onFieldFocus?.(targetOffset);
                  }, 50);
                }}
                style={[styles.suggestionChip, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${name}`}
              >
                <Text style={[styles.suggestionText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  + {name}
                </Text>
              </PressableOpacity>
            ))}
          </View>

          {/* Real-time Calculation Summary Bar */}
          {split.totalShare > 0 && (
            <View style={[styles.summaryBar, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.summaryText, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
                Your share: <Text style={{ fontFamily: FontFamily.bold }}>{formatCurrency(split.myShare)}</Text>
                {'  ·  '}
                {split.members.length === 1
                  ? `${split.members[0].person.trim() || 'They'} owe${split.members[0].person.trim() ? 's' : ''}: `
                  : `${split.members.length} friends owe: `}
                <Text style={{ fontFamily: FontFamily.bold, color: activeColor }}>{formatCurrency(split.totalShare)}</Text>
              </Text>
            </View>
          )}

          {/* Validation Error Message */}
          {split.error ? (
            <Text style={[styles.errorText, { color: colors.coralText, fontFamily: FontFamily.medium }]}>
              {split.error}
            </Text>
          ) : null}
        </View>
      )}
    </FormRow>
  );
};

const styles = StyleSheet.create({
  editor: {
    gap: Spacing.group,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
  },
  equalBtn: {
    height: ControlHeight.compact,
    justifyContent: 'center',
    paddingHorizontal: Spacing.group,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  equalBtnText: {
    fontSize: FontSize.caption,
  },
  memberList: {
    gap: Spacing.element,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ControlHeight.standard,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.group,
    borderWidth: 1,
  },
  nameBox: {
    flex: 1.3,
  },
  amountBox: {
    flex: 0.8,
  },
  iconPrefix: {
    marginRight: 6,
  },
  rupeePrefix: {
    fontSize: FontSize.bodySmall,
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.bodySmall,
    padding: 0,
    includeFontPadding: false,
  },
  amountInput: {
    textAlign: 'right',
  },
  removeBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  addPersonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: ControlHeight.compact,
    paddingHorizontal: Spacing.group,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  addPersonText: {
    fontSize: FontSize.caption,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: FontSize.caption,
  },
  summaryBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.input,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: FontSize.caption,
  },
  errorText: {
    fontSize: FontSize.caption,
  },
});
