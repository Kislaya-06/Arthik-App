import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Zap, ChevronDown, ChevronUp, Flag } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, BorderRadius, LineHeight } from '../../config/theme';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import * as db from '../../features/autoLog/db';
import { reportProblem, ProblemReason } from '../../features/autoLog/reviews';
import { money } from '../../features/autoLog/copy';
import { useAutoLogStore } from '../../features/autoLog/store';
import type { AutoLogEvent } from '../../features/autoLog/types';

/**
 * Source transparency + "Why was this logged?" + "Report a problem" (spec §22, §23, §38.6).
 * Renders nothing for transactions the user added by hand.
 */
interface Props {
  expenseId: string;
  onEditAmount: () => void;
  onDeleted: () => void;
}

const REASONS: Array<[ProblemReason, string]> = [
  ['wrong_amount', 'Wrong amount'],
  ['wrong_type', 'Wrong type (income ↔ expense)'],
  ['duplicate', 'Duplicate'],
  ['wrong_account', 'Wrong account'],
  ['not_transaction', 'Should not have been detected'],
  ['other', 'Other'],
];

export const WhyLoggedCard: React.FC<Props> = ({ expenseId, onEditAmount, onDeleted }) => {
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const autoLogOff = useAutoLogStore((s) => s.loaded && s.mode === 'off');
  const [events, setEvents] = useState<AutoLogEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId || autoLogOff) return;
      try {
        await db.openDb(userId);
        const list = await db.getEventsForExpense(expenseId);
        if (alive) setEvents(list);
      } catch {}
    })();
    return () => { alive = false; };
  }, [expenseId, userId, autoLogOff]);

  const main = events.find((e) => e.expenseId === expenseId) || events[0];
  if (!main) return null;
  const matched = events.filter((e) => e.id !== main.id);
  const last4 = main.accountKey?.split(':')[1] || matched.find((m) => m.accountKey)?.accountKey?.split(':')[1];
  const kindWord = (e: AutoLogEvent) => (e.source === 'sms' ? 'SMS' : e.source === 'email' ? 'email' : 'notification');
  const sources = [main, ...matched].map((e) => `${e.sender} ${kindWord(e)}`);
  const sameRef = !!main.ref && matched.some((m) => m.ref === main.ref);

  const act = async (reason: ProblemReason, ignoreSimilar = false) => {
    setReporting(false);
    if (reason === 'wrong_amount') {
      await reportProblem(main, reason);
      onEditAmount();
      return;
    }
    const r = await reportProblem(main, reason, { ignoreSimilar });
    if (userId) useAutoLogStore.getState().refresh(userId);
    if (r === 'deleted') onDeleted();
    else setDone(r === 'type_flipped' ? 'Type changed. Thanks — Arthik will remember this.' : 'Thanks — your feedback is saved on this device.');
  };

  const pick = (reason: ProblemReason) => {
    if (reason === 'duplicate') {
      Alert.alert('Remove this duplicate?', 'This transaction will be deleted.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => act('duplicate') },
      ]);
    } else if (reason === 'not_transaction') {
      Alert.alert('Not a transaction', `Delete it and ignore…`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Only this message', onPress: () => act('not_transaction', false) },
        { text: `Similar from ${main.sender}`, onPress: () => act('not_transaction', true) },
      ]);
    } else {
      act(reason);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
      <View style={styles.head}>
        <View style={[styles.chip, { backgroundColor: colors.mintGreenSoft }]}>
          <Zap size={12} color={colors.mintGreenDark} />
          <Text style={[styles.chipText, { color: colors.mintGreenDark }]}>
            {main.origin === 'recovery' ? 'Recovered automatically' : 'Automatically detected'}
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Source</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{sources.join(' + ')}</Text>

      <Pressable onPress={() => setOpen((o) => !o)} style={styles.toggle}>
        <Text style={[styles.toggleText, { color: colors.textPrimary }]}>Why was this logged?</Text>
        {open ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
      </Pressable>
      {open ? (
        <View style={[styles.why, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{money(main.amount)}{main.merchant ? ` · ${main.merchant}` : ''}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Arthik detected:</Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>
            • {main.source === 'email' ? `Financial email detected (${main.sender})` : `${main.sender} transaction ${kindWord(main)}`}
          </Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>• Amount: {money(main.amount)}</Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>• {main.direction === 'credit' ? 'Credit' : 'Debit'} transaction</Text>
          {last4 ? <Text style={[styles.text, { color: colors.textPrimary }]}>• Tracked account: ••••{last4}</Text> : null}
          {main.merchant ? <Text style={[styles.text, { color: colors.textPrimary }]}>• Merchant: {main.merchant}</Text> : null}
          {matched.length ? (
            <>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>Matched with:</Text>
              {matched.map((m) => (
                <Text key={m.id} style={[styles.text, { color: colors.textPrimary }]}>• {m.sender} {kindWord(m)}</Text>
              ))}
              {sameRef ? <Text style={[styles.text, { color: colors.textPrimary }]}>• Same transaction reference</Text> : null}
              <Text style={[styles.text, { color: colors.textSecondary, marginTop: Spacing.element }]}>
                {matched.length > 1 ? 'All sources' : 'Both sources'} referred to the same payment, so they were combined into one transaction.
                {main.source === 'email' && matched.some((m) => m.source === 'sms')
                  ? ' The bank SMS arrived later and was matched to this email; it was not needed to confirm it.'
                  : ''}
              </Text>
            </>
          ) : main.source === 'email' ? (
            <Text style={[styles.text, { color: colors.textSecondary, marginTop: Spacing.element }]}>
              Confirmed from the bank email. A bank SMS is optional, so none is expected.
            </Text>
          ) : null}
          {main.origin === 'recovery' ? (
            <Text style={[styles.text, { color: colors.textSecondary, marginTop: Spacing.element }]}>Found while recovering the period you were signed out.</Text>
          ) : null}
        </View>
      ) : null}

      {done ? <Text style={[styles.done, { color: colors.mintGreenDark }]}>{done}</Text> : null}
      <Pressable onPress={() => setReporting(true)} style={styles.report} hitSlop={6}>
        <Flag size={14} color={colors.textSecondary} />
        <Text style={[styles.reportText, { color: colors.textSecondary }]}>Report a problem</Text>
      </Pressable>

      <BottomSheetModal visible={reporting} onClose={() => setReporting(false)} title="What's wrong?" colors={colors} isDark={isDark}>
        <View style={{ gap: Spacing.element }}>
          {REASONS.map(([k, label]) => (
            <AppButton key={k} label={label} variant="outline" onPress={() => pick(k)} />
          ))}
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.card, padding: Spacing.surface, marginTop: Spacing.block },
  head: { flexDirection: 'row', marginBottom: Spacing.group },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  label: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  value: { fontSize: FontSize.body, fontFamily: FontFamily.bold, marginTop: Spacing.nano },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.block },
  toggleText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  why: { borderTopWidth: 1, marginTop: Spacing.element, paddingTop: Spacing.element },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, marginTop: Spacing.element, marginBottom: Spacing.micro },
  text: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.medium },
  done: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, marginTop: Spacing.group },
  report: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.block },
  reportText: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold },
});
