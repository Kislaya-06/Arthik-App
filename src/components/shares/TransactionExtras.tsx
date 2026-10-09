import React from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { Users, Repeat } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { ReimbursementCandidate, ShareDraft, computeSplit } from '../../lib/shares';

export interface TransactionExtrasProps {
  transactionType: 'expense' | 'income';
  amount: number;
  shareDrafts: ShareDraft[];
  onOpenSplit: () => void;
  candidates: ReimbursementCandidate[];
  linkedShareId: string | null;
  onLinkShare: (shareId: string | null) => void;
  linkDeclined: boolean;
  onDeclineLink: () => void;
  isSelfTransfer: boolean;
  onToggleSelfTransfer: (on: boolean) => void;
  rememberMode: 'always' | 'once';
  onRememberMode: (m: 'always' | 'once') => void;
  canRemember: boolean;
  ruleMatched: boolean;
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Compact, optional extras under the form: split, reimbursement link, self-transfer. */
export const TransactionExtras: React.FC<TransactionExtrasProps> = (p) => {
  const { colors } = useTheme();
  const showReimbursement = p.transactionType === 'income' && !p.isSelfTransfer && !p.linkDeclined && p.candidates.length > 0;
  const split = computeSplit(p.amount, p.shareDrafts);

  return (
    <View style={styles.wrap}>
      {p.transactionType === 'expense' && !p.isSelfTransfer && p.amount > 0 ? (
        <Pressable onPress={p.onOpenSplit} style={[styles.row, { backgroundColor: colors.inputBg }]}>
          <Users size={18} color={colors.textSecondary} />
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {p.shareDrafts.length ? `Split with ${p.shareDrafts.length} ${p.shareDrafts.length === 1 ? 'person' : 'people'}` : 'Split expense'}
            </Text>
            {p.shareDrafts.length ? (
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                Friends {formatCurrency(split.friendsTotal)} · Your share {formatCurrency(split.yourShare)}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.link, { color: colors.mintGreenDark }]}>{p.shareDrafts.length ? 'Edit' : 'Add shares'}</Text>
        </Pressable>
      ) : null}

      {showReimbursement ? (
        <View style={[styles.card, { backgroundColor: colors.mintGreenSoft }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Is this your friend’s share for a previous expense?</Text>
          {p.candidates.map((c) => {
            const selected = p.linkedShareId === c.share.id;
            return (
              <Pressable
                key={c.share.id}
                onPress={() => p.onLinkShare(selected ? null : c.share.id)}
                style={[styles.option, { borderColor: selected ? colors.mintGreenDark : colors.borderSubtle }]}
              >
                <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                  {c.share.friend_label} · {formatCurrency(c.outstanding)} owed
                </Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {fmtDate(c.expenseDate)} expense of {formatCurrency(c.expenseAmount)}
                </Text>
              </Pressable>
            );
          })}
          <View style={styles.actions}>
            <Text style={[styles.link, { color: colors.textSecondary }]} onPress={p.onDeclineLink}>No, it’s income</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {p.linkedShareId ? 'Will be saved as a Reimbursement' : p.candidates.length > 1 ? 'Pick one to link' : 'Tap to link'}
            </Text>
          </View>
        </View>
      ) : null}

      {!p.linkedShareId ? (
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
      ) : null}

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
  link: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  hint: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  option: { borderWidth: 1, borderRadius: BorderRadius.input, padding: Spacing.group },
  optionText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pills: { flexDirection: 'row', gap: Spacing.group, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingVertical: Spacing.element, paddingHorizontal: Spacing.block },
});
