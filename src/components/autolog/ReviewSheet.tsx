import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { useTheme } from '../../store/themeStore';
import { useCategoryStore } from '../../store/categoryStore';
import { getCategoryIcon } from '../../lib/iconUtils';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../../config/theme';
import type { AutoLogEvent, TrackedAccount } from '../../features/autoLog/types';
import { accountLabelFromKey, dateTime, eventTitle, money } from '../../features/autoLog/copy';
import { classifyEvent, ignoreEvent, learnFromDiscovery, resolveDuplicate, resolveSplitRepayment, resolveTransfer, setEventCategory } from '../../features/autoLog/reviews';
import { findSplitRepaymentCandidates } from '../../features/autoLog/ledger';
import type { ReimbursementCandidate } from '../../lib/shares';
import { formatCurrency } from '../../lib/formatters';

/**
 * One sheet for every review decision. Flow (spec §9, §18–21):
 *   What is this? → [Income | Expense] → "You chose X — Confirm?" [Go Back | Confirm]
 *   → category (live only) → "Remember Zomato → Food?" → done
 * Discovery items only teach formats; they never create a transaction.
 */

type Step = 'start' | 'confirm' | 'category' | 'remember' | 'ignore';

interface Props {
  visible: boolean;
  event: AutoLogEvent | null;
  accounts: TrackedAccount[];
  discovery?: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}

export const ReviewSheet: React.FC<Props> = ({ visible, event, accounts, discovery = false, onClose, onDone }) => {
  const { colors, isDark } = useTheme();
  const categories = useCategoryStore((s) => s.categories);
  const [step, setStep] = useState<Step>('start');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitCandidates, setSplitCandidates] = useState<ReimbursementCandidate[]>([]);
  const [splitDeclined, setSplitDeclined] = useState(false);

  const categoryOnly = !!event && event.status === 'logged' && event.needsCategory;

  useEffect(() => {
    if (visible) {
      setStep(categoryOnly ? 'category' : 'start');
      setType(event?.direction === 'credit' ? 'income' : 'expense');
      setCategoryId(null);
      setAmountText('');
      setError(null);
      setBusy(false);
      setSplitDeclined(false);
      setSplitCandidates([]);
    }
  }, [visible, event?.id, categoryOnly, event?.direction]);

  // "Is this your friend's share of a split?" needs the friends still owing money for this exact amount.
  useEffect(() => {
    let alive = true;
    if (visible && event?.reviewReason === 'split_repayment' && event.amount != null) {
      findSplitRepaymentCandidates(event.amount, event.occurredAt).then((c) => { if (alive) setSplitCandidates(c); });
    }
    return () => { alive = false; };
  }, [visible, event?.id, event?.reviewReason, event?.amount, event?.occurredAt]);

  const usableCategories = useMemo(() => categories.filter((c) => !c.isPlaceholder), [categories]);
  const chosenCategory = usableCategories.find((c) => c.id === categoryId);
  const account = event ? accountLabelFromKey(event.accountKey, accounts) : null;
  // Discovery only teaches the format, so it never needs an amount.
  const needsAmount = !discovery && !!event && event.amount == null;
  const typedAmount = Number(amountText.replace(/,/g, ''));
  const amount = needsAmount ? (Number.isFinite(typedAmount) && typedAmount > 0 ? typedAmount : null) : event?.amount ?? null;

  if (!event) return null;

  const run = async (fn: () => Promise<void>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone(message);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pick = (t: 'expense' | 'income') => {
    if (needsAmount && !amount) {
      setError('Enter the amount first.');
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setType(t);
    setStep('confirm');
  };

  const finish = (remember: boolean) => {
    if (categoryOnly) {
      return run(() => setEventCategory(event, categoryId as string, remember), 'Category saved');
    }
    return run(async () => {
      await classifyEvent(event, type, categoryId, remember, needsAmount ? amount ?? undefined : undefined);
    }, `${money(amount)} logged as ${type === 'income' ? 'income' : 'an expense'}`);
  };

  const afterCategory = (id: string | null) => {
    setCategoryId(id);
    if (id && event.merchant) setStep('remember');
    else if (categoryOnly && id) run(() => setEventCategory(event, id, false), 'Category saved');
    else run(() => classifyEvent(event, type, id, false, needsAmount ? amount ?? undefined : undefined).then(() => undefined), `${money(amount)} logged`);
  };

  // ── Summary block shown at the top of every step ──
  const summary = (
    <View style={[styles.summary, { backgroundColor: colors.cardSubtle }]}>
      <Text style={[styles.amount, { color: colors.textPrimary }]}>{money(amount)}</Text>
      <Text style={[styles.meta, { color: colors.textPrimary }]}>{eventTitle(event)}</Text>
      <Text style={[styles.metaMuted, { color: colors.textSecondary }]}>
        {[account, dateTime(event.occurredAt), event.source === 'notification' ? `${event.sender} notification` : event.source === 'email' ? `${event.sender} email` : null].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );

  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;
  let title = 'Review';

  if (step === 'start' && event.reviewReason === 'split_repayment' && !splitDeclined) {
    title = 'Friend paid back?';
    content = (
      <>
        {summary}
        <Text style={[styles.question, { color: colors.textPrimary }]}>
          {money(amount)} came in. A friend still owes exactly this on a split. Is this the split money?
        </Text>
        {splitCandidates.map((c) => (
          <View key={c.share.id} style={[styles.summary, { backgroundColor: colors.mintGreenSoft }]}>
            <Text style={[styles.meta, { color: colors.textPrimary }]}>{c.share.friend_label} · {formatCurrency(c.outstanding)} owed</Text>
            <Text style={[styles.metaMuted, { color: colors.textSecondary }]}>
              Split created on {c.expenseDate.split('-').reverse().slice(0, 2).join('/')} · expense of {formatCurrency(c.expenseAmount)}
            </Text>
          </View>
        ))}
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          If yes, that split is closed and the money goes back to where it was paid from: Gullak, income or budget.
        </Text>
      </>
    );
    footer = (
      <View style={styles.footerCol}>
        {splitCandidates.map((c) => (
          <AppButton
            key={c.share.id}
            label={splitCandidates.length > 1 ? `Yes — from ${c.share.friend_label}` : `Yes, split money from ${c.share.friend_label}`}
            variant="secondary"
            loading={busy}
            onPress={() => run(() => resolveSplitRepayment(event, c.share.id, c.share.friend_label).then(() => undefined), 'Split settled — money added back')}
          />
        ))}
        <AppButton
          label="No, it's something else"
          variant="outline"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await resolveSplitRepayment(event, null);   // remembers: this one is NOT a split repayment
              setSplitDeclined(true);                     // continue in the same sheet with "What is this?"
            } catch (e: any) {
              setError(e?.message || 'Something went wrong. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    );
  } else if (step === 'start' && event.reviewReason === 'possible_transfer') {
    title = 'Own transfer?';
    content = (
      <>
        {summary}
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          The same amount went out of one of your accounts and came into another within minutes. Is this a transfer between your own accounts?
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          Nothing has been deleted. If you say yes, it will not count as income or expense.
        </Text>
      </>
    );
    footer = (
      <View style={styles.footerCol}>
        <AppButton label="Yes, my own transfer" variant="secondary" loading={busy} onPress={() => run(() => resolveTransfer(event, true), 'Marked as a transfer')} />
        <AppButton label="No, a separate payment" variant="outline" disabled={busy} onPress={() => run(() => resolveTransfer(event, false), 'Logged as a separate payment')} />
      </View>
    );
  } else if (step === 'start' && event.reviewReason === 'possible_duplicate') {
    title = 'Possible duplicate';
    content = (
      <>
        {summary}
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          You already have a manual entry with the same amount on this day. Is this the same payment?
        </Text>
      </>
    );
    footer = (
      <View style={styles.footerCol}>
        <AppButton label="Yes, same payment — don't add" variant="secondary" loading={busy} onPress={() => run(() => resolveDuplicate(event, true), 'Kept your manual entry')} />
        <AppButton label="No, it's a different payment" variant="outline" disabled={busy} onPress={() => run(() => resolveDuplicate(event, false), 'Logged as a separate transaction')} />
      </View>
    );
  } else if (step === 'start') {
    title = discovery ? 'Help Arthik understand' : 'What is this?';
    content = (
      <>
        {summary}
        <Text style={[styles.label, { color: colors.textSecondary }]}>MESSAGE</Text>
        <Text style={[styles.quote, { color: colors.textPrimary, borderLeftColor: colors.mintGreen }]} numberOfLines={6}>
          {event.body}
        </Text>
        {needsAmount && !discovery ? (
          <View style={[styles.amountBox, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.rupee, { color: colors.textSecondary }]}>₹</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="Amount"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              style={[styles.amountInput, { color: colors.textPrimary }]}
            />
          </View>
        ) : null}
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {discovery
            ? 'Is this a real transaction? Your answer only teaches Arthik this message format. Nothing will be added to your history.'
            : 'Arthik is not sure, so it will not guess. Choose what this is.'}
        </Text>
      </>
    );
    footer = (
      <View style={styles.footerCol}>
        <View style={styles.footerRow}>
          <AppButton label="Expense" variant="secondary" style={styles.flex} onPress={() => pick('expense')} />
          <AppButton label="Income" variant="secondary" style={styles.flex} onPress={() => pick('income')} />
        </View>
        <AppButton label={discovery ? 'Not a transaction — Ignore' : 'Not a transaction'} variant="ghost" onPress={() => setStep('ignore')} />
      </View>
    );
  } else if (step === 'confirm') {
    title = `You chose ${type === 'income' ? 'Income' : 'Expense'}`;
    content = (
      <>
        {summary}
        <Text style={[styles.question, { color: colors.textPrimary }]}>
          Confirm that this is {type === 'income' ? 'income' : 'an expense'}?
        </Text>
        {discovery ? (
          <Text style={[styles.text, { color: colors.textSecondary }]}>We'll use this format for future transactions.</Text>
        ) : null}
      </>
    );
    footer = (
      <View style={styles.footerRow}>
        <AppButton label="Go Back" variant="outline" style={styles.flex} disabled={busy} onPress={() => setStep('start')} />
        <AppButton
          label="Confirm"
          style={styles.flex}
          loading={busy}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            if (discovery) {
              run(() => learnFromDiscovery(event, type === 'income' ? 'credit' : 'debit'), "We'll use this format for future transactions.");
            } else {
              setStep('category');
            }
          }}
        />
      </View>
    );
  } else if (step === 'category') {
    title = 'Choose a category';
    content = (
      <>
        {summary}
        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
          {usableCategories.map((c) => {
            const Icon = getCategoryIcon(c.icon);
            const selected = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => afterCategory(c.id)}
                style={[styles.catRow, { borderColor: selected ? colors.mintGreenDark : colors.borderSubtle }]}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color }]}>
                  <Icon size={16} color="#1A2B4C" />
                </View>
                <Text style={[styles.catText, { color: colors.textPrimary }]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </>
    );
    footer = categoryOnly ? null : (
      <AppButton label="Skip — choose later" variant="ghost" loading={busy} onPress={() => afterCategory(null)} />
    );
  } else if (step === 'remember') {
    title = 'Remember this?';
    content = (
      <>
        <Text style={[styles.question, { color: colors.textPrimary }]}>Remember this preference for similar transactions?</Text>
        <View style={[styles.summary, { backgroundColor: colors.mintGreenSoft }]}>
          <Text style={[styles.meta, { color: colors.textPrimary }]}>
            {event.merchant} → {chosenCategory?.name}
          </Text>
        </View>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          Saved on this device only. Future payments to {event.merchant} will use this category.
        </Text>
      </>
    );
    footer = (
      <View style={styles.footerRow}>
        <AppButton label="Just this once" variant="outline" style={styles.flex} disabled={busy} onPress={() => finish(false)} />
        <AppButton label="Yes, remember" style={styles.flex} loading={busy} onPress={() => finish(true)} />
      </View>
    );
  } else if (step === 'ignore') {
    title = 'Ignore';
    content = (
      <>
        {summary}
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          "Similar" means this exact message format from {event.sender} — not every message with the same amount.
        </Text>
      </>
    );
    footer = (
      <View style={styles.footerCol}>
        <AppButton label="Ignore only this message" variant="secondary" loading={busy} onPress={() => run(() => ignoreEvent(event, 'message'), 'Ignored')} />
        <AppButton label={`Ignore similar messages from ${event.sender}`} variant="outline" disabled={busy} onPress={() => run(() => ignoreEvent(event, 'similar'), 'Similar messages will be ignored')} />
        <AppButton label="Go Back" variant="ghost" disabled={busy} onPress={() => setStep('start')} />
      </View>
    );
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={title} colors={colors} isDark={isDark} footer={
      <View>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {footer}
      </View>
    }>
      {content}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  summary: { borderRadius: BorderRadius.input, padding: Spacing.block, marginBottom: Spacing.block },
  amount: { fontSize: FontSize.titleLarge, lineHeight: LineHeight.titleLarge, fontFamily: FontFamily.bold },
  meta: { fontSize: FontSize.body, fontFamily: FontFamily.bold, marginTop: Spacing.nano },
  metaMuted: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: Spacing.micro },
  label: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: 0.6, marginBottom: Spacing.micro },
  quote: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.medium, borderLeftWidth: 3, paddingLeft: Spacing.group, marginBottom: Spacing.block },
  text: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.medium, marginBottom: Spacing.element },
  question: { fontSize: FontSize.titleSmall, lineHeight: LineHeight.titleSmall, fontFamily: FontFamily.bold, marginBottom: Spacing.element },
  footerCol: { gap: Spacing.group },
  footerRow: { flexDirection: 'row', gap: Spacing.group },
  flex: { flex: 1 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, paddingVertical: Spacing.group, paddingHorizontal: Spacing.group, borderWidth: 1, borderRadius: BorderRadius.input, marginBottom: Spacing.element },
  catIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catText: { fontSize: FontSize.body, fontFamily: FontFamily.semibold },
  amountBox: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.input, paddingHorizontal: Spacing.block, height: 52, marginBottom: Spacing.group },
  rupee: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold, marginRight: Spacing.element },
  amountInput: { flex: 1, fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold },
  error: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold, marginBottom: Spacing.element, textAlign: 'center' },
});
