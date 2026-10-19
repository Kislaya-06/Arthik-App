import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { Users, Plus, X, User } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { MAX_PERSON_NAME, personKey } from '../../lib/splitLedger';
import { AnimatedToggle } from '../AnimatedToggle';
import type { SplitFormState } from '../../hooks/useExpenseForm';

export interface SplitExtrasProps {
  split: SplitFormState;
  onFieldFocus?: (relativeY?: number) => void;
}

/**
 * Split expense section under the form (SPL-001):
 * - Capsule pill trigger with theme AnimatedToggle
 * - Clean, spacious card for adding multiple people with custom or equal shares
 */
export const SplitExtras: React.FC<SplitExtrasProps> = ({ split, onFieldFocus }) => {
  const { colors, isDark } = useTheme();
  const rowOffsets = useRef<Record<number, number>>({});
  if (!split.visible) return null;

  const existingKeys = new Set(split.members.map((m) => personKey(m.person)));
  const suggestions = split.knownNames
    .filter((name) => !existingKeys.has(personKey(name)))
    .slice(0, 4);

  const activeColor = isDark ? colors.mintGreen : colors.forestGreen;

  return (
    <View style={styles.container}>
      {/* ── Capsule Pill Trigger ── */}
      <Pressable
        onPress={() => {
          if (!split.on) onFieldFocus?.();
          split.setOn(!split.on);
        }}
        style={[
          styles.pillTrigger,
          {
            backgroundColor: colors.inputBg,
            borderColor: split.on ? activeColor : colors.borderSubtle,
          },
        ]}
        accessibilityRole="switch"
        accessibilityState={{ checked: split.on }}
        accessibilityLabel="Split this expense"
      >
        <View style={styles.pillLeft}>
          <Users size={18} color={split.on ? activeColor : colors.textSecondary} />
          <Text style={[styles.pillTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            Split this expense
          </Text>
        </View>

        <AnimatedToggle
          value={split.on}
          onValueChange={(on) => {
            if (on) onFieldFocus?.();
            split.setOn(on);
          }}
          width={50}
          height={26}
        />
      </Pressable>

      {/* ── Expanded Split Card ── */}
      {split.on && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          {/* Header Row: Title + Split Equally Action */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
              WHO SHARES THIS?
            </Text>
            <Pressable
              onPress={split.splitEqually}
              hitSlop={8}
              style={[styles.equalBtn, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Split equally"
            >
              <Text style={[styles.equalBtnText, { color: activeColor, fontFamily: FontFamily.bold }]}>
                Split equally
              </Text>
            </Pressable>
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
                  <Pressable
                    onPress={() => split.removeMember(index)}
                    hitSlop={8}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove person ${index + 1}`}
                  >
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Bottom Actions: + Add Person & Quick Suggestions */}
          <View style={styles.actionsRow}>
            <Pressable
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
            </Pressable>

            {suggestions.map((name) => (
              <Pressable
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
              </Pressable>
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
            <Text style={[styles.errorText, { color: colors.coral, fontFamily: FontFamily.medium }]}>
              {split.error}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.block, // 16px vertical breathing space from PAID VIA
    marginBottom: Spacing.element,
    gap: Spacing.group, // 12px between pill and expanded card
  },
  pillTrigger: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    borderWidth: 1,
  },
  pillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
  },
  pillTitle: {
    fontSize: FontSize.body,
    includeFontPadding: false,
  },
  card: {
    borderRadius: BorderRadius.card,
    padding: Spacing.block,
    gap: Spacing.group,
    borderWidth: 1,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
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
