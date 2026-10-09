import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { ShareDraft, computeSplit, validateShares } from '../../lib/shares';

interface Props {
  visible: boolean;
  /** Total amount paid for the expense. */
  total: number;
  initial: ShareDraft[];
  onClose: () => void;
  onSave: (drafts: ShareDraft[]) => void;
}

interface Row { key: string; name: string; amount: string }

let rowSeq = 0;
const newRow = (name = '', amount = ''): Row => ({ key: `r${++rowSeq}`, name, amount });

/** Compact "Split expense" sheet: who owes what. The original expense amount is never changed. */
export const SplitExpenseModal: React.FC<Props> = ({ visible, total, initial, onClose, onSave }) => {
  const { colors, isDark } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRows(initial.length ? initial.map((d) => newRow(d.friendLabel, String(d.amount))) : [newRow()]);
      setError(null);
    }
  }, [visible, initial]);

  const drafts: ShareDraft[] = rows.map((r) => ({
    friendLabel: r.name,
    amount: Number(r.amount.replace(/,/g, '')) || 0,
  }));
  const filled = drafts.filter((d) => d.friendLabel.trim() || d.amount > 0);
  const split = computeSplit(total, filled);
  const over = split.friendsTotal > total;

  const update = (key: string, patch: Partial<Row>) => {
    setError(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const save = () => {
    const err = filled.length ? validateShares(total, filled) : null;
    if (err) { setError(err); return; }
    onSave(filled);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Split expense"
      colors={colors}
      isDark={isDark}
      footer={
        <View>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <AppButton label={filled.length ? 'Save split' : 'Remove split'} onPress={save} disabled={over} />
        </View>
      }
    >
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <TextInput
            value={r.name}
            onChangeText={(t) => update(r.key, { name: t })}
            placeholder="Friend's name"
            placeholderTextColor={colors.textMuted}
            maxLength={80}
            style={[styles.input, styles.nameInput, { backgroundColor: colors.inputBg, color: colors.textPrimary }]}
          />
          <TextInput
            value={r.amount}
            onChangeText={(t) => update(r.key, { amount: t.replace(/[^0-9.]/g, '') })}
            placeholder="₹ share"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.amountInput, { backgroundColor: colors.inputBg, color: colors.textPrimary }]}
          />
          {rows.length > 1 ? (
            <Pressable hitSlop={8} onPress={() => setRows((p) => p.filter((x) => x.key !== r.key))}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable style={styles.addRow} onPress={() => setRows((p) => [...p, newRow()])}>
        <Plus size={16} color={colors.mintGreenDark} />
        <Text style={[styles.addText, { color: colors.mintGreenDark }]}>Add another person</Text>
      </Pressable>

      <View style={[styles.summary, { backgroundColor: colors.cardSubtle }]}>
        <Line label="Total paid" value={formatCurrency(total)} colors={colors} />
        <Line label="Friends' shares" value={formatCurrency(split.friendsTotal)} colors={colors} danger={over} />
        <Line label="Your share" value={formatCurrency(Math.max(0, split.yourShare))} colors={colors} bold />
      </View>
    </BottomSheetModal>
  );
};

const Line: React.FC<{ label: string; value: string; colors: any; bold?: boolean; danger?: boolean }> = ({ label, value, colors, bold, danger }) => (
  <View style={styles.line}>
    <Text style={[styles.lineLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.lineValue, { color: danger ? colors.danger : colors.textPrimary, fontFamily: bold ? FontFamily.bold : FontFamily.semibold }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, marginBottom: Spacing.group },
  input: { height: 48, borderRadius: BorderRadius.input, paddingHorizontal: Spacing.block, fontSize: FontSize.body, fontFamily: FontFamily.medium },
  nameInput: { flex: 1 },
  amountInput: { width: 104 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element, paddingVertical: Spacing.group },
  addText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  summary: { borderRadius: BorderRadius.input, padding: Spacing.block, marginTop: Spacing.element },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  lineLabel: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium },
  lineValue: { fontSize: FontSize.bodySmall },
  error: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold, marginBottom: Spacing.element, textAlign: 'center' },
});
