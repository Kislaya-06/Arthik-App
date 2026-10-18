import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ShieldCheck, Users, CircleOff } from 'lucide-react-native';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { SegmentedControl, SegmentedOption } from '../ui/SegmentedControl';
import { Checkbox } from './AutoLogUi';
import { useTheme } from '../../store/themeStore';
import { useCategoryStore } from '../../store/categoryStore';
import { getCategoryIcon } from '../../lib/iconUtils';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight } from '../../config/theme';
import type { AutoLogEvent, TrackedAccount } from '../../features/autoLog/types';
import { accountLabelFromKey, dateTime, eventTitle, money } from '../../features/autoLog/copy';
import { useExpenseStore } from '../../store/expenseStore';
import { navigationRef } from '../../navigation/navigationRef';
import { convertIncomeToMoneyBack } from '../../store/expense/moneyBack';
import { buildPeopleLedger, matchIncomingToPeople } from '../../lib/splitLedger';
import {
  classifyEvent,
  setEventCategory,
  ignoreEvent,
  learnFromDiscovery,
  resolveDuplicate,
  resolveTransfer,
  discardEvent,
} from '../../features/autoLog/reviews';

/**
 * Concise single-sheet AutoLog review (Spec §9, §18-21).
 * Presents Type + Category + Remember preference on 1 screen.
 * Saves ONLY when the user explicitly taps the primary Save button.
 */

interface Props {
  visible: boolean;
  event: AutoLogEvent | null;
  accounts: TrackedAccount[];
  discovery?: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}

const TYPE_OPTIONS: SegmentedOption[] = [
  { key: 'expense', label: '💸 Expense' },
  { key: 'income', label: '💰 Income' },
];

const GRID_GAP = 10;

export const ReviewSheet: React.FC<Props> = ({
  visible,
  event,
  accounts,
  discovery = false,
  onClose,
  onDone,
}) => {
  const { colors, isDark } = useTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const categories = useCategoryStore((s) => s.categories);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOnly = !!event && event.status === 'logged' && event.needsCategory;

  // Sizing calculations for fintech-grade 2-column grid and screen-elevated sheet
  const availableWidth = Math.max(windowWidth - Spacing.gutter * 2, 280);
  const chipWidth = Math.floor((availableWidth - GRID_GAP) / 2);
  const sheetHeight = Math.min(Math.round(windowHeight * 0.86), 740);

  useEffect(() => {
    if (visible && event) {
      setType(event.direction === 'credit' ? 'income' : 'expense');
      setCategoryId(null);
      setRemember(Boolean(event.merchant || event.sender));
      setAmountText('');
      setError(null);
      setBusy(false);
    }
  }, [visible, event?.id, event?.direction, event?.merchant, event?.sender]);

  // SPL-005: a credit may be a friend paying back. People who still owe money are offered.
  const allExpenses = useExpenseStore((s) => s.expenses);
  const owingPeople = useMemo(() => {
    if (!event || discovery || event.direction !== 'credit') return [];
    const people = buildPeopleLedger(allExpenses).filter((p) => p.owed > 0);
    const matched = matchIncomingToPeople(people, {
      amount: event.amount ?? 0,
      sender: event.merchant,
    });
    const matchedKeys = new Set(matched.map((m) => m.person.key));
    return [
      ...matched.map((m) => ({ ...m.person, matched: true as const })),
      ...people.filter((p) => !matchedKeys.has(p.key)).map((p) => ({ ...p, matched: false as const })),
    ];
  }, [allExpenses, event, discovery]);

  const usableCategories = useMemo(() => categories.filter((c) => !c.isPlaceholder), [categories]);
  const chosenCategory = usableCategories.find((c) => c.id === categoryId);
  const account = event ? accountLabelFromKey(event.accountKey, accounts) : null;
  const needsAmount = !discovery && !!event && event.amount == null;
  const typedAmount = Number(amountText.replace(/,/g, ''));
  const amount = needsAmount
    ? Number.isFinite(typedAmount) && typedAmount > 0
      ? typedAmount
      : null
    : event?.amount ?? null;

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

  const handleSave = () => {
    if (needsAmount && !amount) {
      setError('Enter the amount first.');
      return;
    }
    if (categoryOnly) {
      if (!categoryId) {
        setError('Please select a category.');
        return;
      }
      return run(() => setEventCategory(event, categoryId, remember), 'Category saved');
    }
    if (discovery) {
      return run(
        () => learnFromDiscovery(event, type === 'income' ? 'credit' : 'debit'),
        "We'll use this format for future transactions."
      );
    }
    return run(async () => {
      await classifyEvent(
        event,
        type,
        categoryId,
        remember,
        needsAmount ? amount ?? undefined : undefined
      );
    }, `${money(amount)} logged as ${type === 'income' ? 'income' : 'an expense'}`);
  };

  const settleWith = (personName: string) =>
    run(async () => {
      const logged = await classifyEvent(
        event,
        'income',
        null,
        false,
        needsAmount ? amount ?? undefined : undefined
      );
      if (!logged.expenseId) throw new Error('Could not log this payment. Please try again.');
      await convertIncomeToMoneyBack({ incomeId: logged.expenseId, kind: 'settlement', who: personName });
    }, `${personName} paid back ${money(amount)}`);

  const logAndSplit = () => {
    if (needsAmount && !amount) {
      setError('Enter the amount first.');
      return;
    }
    return run(async () => {
      const logged = await classifyEvent(
        event,
        'expense',
        null,
        false,
        needsAmount ? amount ?? undefined : undefined
      );
      if (logged.expenseId && navigationRef.isReady()) {
        (navigationRef as any).navigate('EditExpense', { expenseId: logged.expenseId, splitOn: true });
      }
    }, `${money(amount)} logged as an expense`);
  };

  const handleIgnore = () => {
    Alert.alert(
      'Ignore message?',
      `Choose how you want Arthik to handle messages from ${event.sender}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ignore only this message', onPress: () => run(() => ignoreEvent(event, 'message'), 'Ignored') },
        {
          text: `Ignore similar from ${event.sender}`,
          onPress: () => run(() => ignoreEvent(event, 'similar'), 'Similar messages will be ignored'),
        },
      ]
    );
  };

  const handleDiscard = () => {
    Alert.alert(
      categoryOnly ? 'Delete transaction?' : 'Discard review?',
      categoryOnly
        ? 'This transaction will be removed from your expenses.'
        : 'This item will be removed from pending reviews and will not be logged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: categoryOnly ? 'Delete' : 'Discard',
          style: 'destructive',
          onPress: () => run(() => discardEvent(event), categoryOnly ? 'Transaction deleted' : 'Review discarded'),
        },
      ]
    );
  };

  // ── Summary card ──
  const summary = (
    <View style={[styles.summary, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle, borderWidth: isDark ? 1 : 0 }]}>
      <View style={styles.summaryTopRow}>
        <Text style={[styles.amount, { color: colors.textPrimary }]}>{money(amount)}</Text>
        {discovery ? (
          <View style={[styles.discoveryBadge, { backgroundColor: colors.mintGreenSoft }]}>
            <ShieldCheck size={12} color={colors.mintGreenDark} />
            <Text style={[styles.discoveryBadgeText, { color: colors.mintGreenDark }]}>Discovery</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.meta, { color: colors.textPrimary }]}>{eventTitle(event)}</Text>
      <Text style={[styles.metaMuted, { color: colors.textSecondary }]}>
        {[
          account,
          dateTime(event.occurredAt),
          event.source === 'notification' ? `${event.sender} notification` : event.source === 'email' ? `${event.sender} email` : null,
        ].filter(Boolean).join(' · ')}
      </Text>
      {event.body ? (
        <View style={[styles.quoteBox, { backgroundColor: colors.background, borderColor: colors.borderSubtle, borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.quoteText, { color: colors.textSecondary }]} numberOfLines={2}>
            {event.body}
          </Text>
        </View>
      ) : null}
    </View>
  );

  let title = categoryOnly ? 'Categorize' : discovery ? 'Teach Format' : 'Review Transaction';
  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (event.reviewReason === 'possible_transfer') {
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
        <AppButton label="Yes, my own transfer" variant="secondary" size="standard" loading={busy} onPress={() => run(() => resolveTransfer(event, true), 'Marked as a transfer')} />
        <AppButton label="No, a separate payment" variant="outline" size="standard" disabled={busy} onPress={() => run(() => resolveTransfer(event, false), 'Logged as a separate payment')} />
      </View>
    );
  } else if (event.reviewReason === 'possible_duplicate') {
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
        <AppButton label="Yes, same payment — don't add" variant="secondary" size="standard" loading={busy} onPress={() => run(() => resolveDuplicate(event, true), 'Kept your manual entry')} />
        <AppButton label="No, it's a different payment" variant="outline" size="standard" disabled={busy} onPress={() => run(() => resolveDuplicate(event, false), 'Logged as a separate transaction')} />
      </View>
    );
  } else {
    // ── Unified 1-page concise review content ──
    content = (
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {summary}

        {needsAmount && !discovery ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>ENTER AMOUNT</Text>
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
          </View>
        ) : null}

        {!categoryOnly ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TRANSACTION TYPE</Text>
            <SegmentedControl
              options={TYPE_OPTIONS}
              selectedKey={type}
              onChange={(k) => {
                Haptics.selectionAsync().catch(() => {});
                setType(k as 'expense' | 'income');
              }}
              height={ControlHeight.standard}
              activePillColor={type === 'expense' ? colors.peachCoral : colors.mintGreen}
              activeTextColor={colors.forestGreen}
              backgroundColor={colors.inputBg}
              fontSize={FontSize.bodySmall}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
            {chosenCategory ? <Text style={[styles.chosenLabel, { color: colors.mintGreenDark }]}>{chosenCategory.name}</Text> : null}
          </View>
          <View style={styles.categoryChipsWrap}>
            {!categoryOnly ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCategoryId(null);
                }}
                style={({ pressed }) => [
                  styles.catChip,
                  {
                    width: chipWidth,
                    backgroundColor: categoryId === null
                      ? isDark
                        ? 'rgba(184, 224, 200, 0.16)'
                        : colors.mintGreenSoft
                      : colors.cardSubtle,
                    borderColor: categoryId === null ? colors.mintGreenDark : colors.borderSubtle,
                    borderWidth: categoryId === null ? 1.5 : 1,
                  },
                  pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.catIconBadge, { backgroundColor: isDark ? '#1F2937' : '#E2E8F0' }]}>
                  <CircleOff size={14} color={categoryId === null ? colors.mintGreenDark : colors.textSecondary} strokeWidth={2.4} />
                </View>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.catChipText,
                    {
                      color: categoryId === null ? colors.textPrimary : colors.textSecondary,
                      fontFamily: categoryId === null ? FontFamily.bold : FontFamily.semibold,
                    },
                  ]}
                >
                  None
                </Text>
                {categoryId === null ? (
                  <View style={styles.catCheckWrapper}>
                    <Check size={13} color={colors.mintGreenDark} strokeWidth={2.8} />
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            {usableCategories.map((c) => {
              const Icon = getCategoryIcon(c.icon);
              const selected = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCategoryId(selected ? null : c.id);
                  }}
                  style={({ pressed }) => [
                    styles.catChip,
                    {
                      width: chipWidth,
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(184, 224, 200, 0.16)'
                          : colors.mintGreenSoft
                        : colors.cardSubtle,
                      borderColor: selected ? colors.mintGreenDark : colors.borderSubtle,
                      borderWidth: selected ? 1.5 : 1,
                    },
                    pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={[styles.catIconBadge, { backgroundColor: c.color || colors.mintGreen }]}>
                    <Icon size={14} color="#1A2B4C" strokeWidth={2.4} />
                  </View>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.catChipText,
                      {
                        color: selected ? colors.textPrimary : colors.textSecondary,
                        fontFamily: selected ? FontFamily.bold : FontFamily.semibold,
                      },
                    ]}
                  >
                    {c.name}
                  </Text>
                  {selected ? (
                    <View style={styles.catCheckWrapper}>
                      <Check size={13} color={colors.mintGreenDark} strokeWidth={2.8} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setRemember((r) => !r);
          }}
          style={({ pressed }) => [
            styles.rememberRow,
            {
              backgroundColor: colors.cardSubtle,
              borderColor: remember ? colors.mintGreenDark : colors.borderSubtle,
              borderWidth: remember ? 1.5 : 1,
            },
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
        >
          <Checkbox checked={remember} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rememberTitle, { color: colors.textPrimary }]}>
              {event.merchant ? `Remember preference for "${event.merchant}"` : 'Remember this preference'}
            </Text>
            <Text style={[styles.rememberSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {chosenCategory ? `Auto-assign "${chosenCategory.name}" to future similar transactions` : 'Auto-assign this choice to future similar transactions'}
            </Text>
          </View>
        </Pressable>

        {owingPeople.length > 0 && type === 'income' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PAID BACK BY SOMEONE?</Text>
            <View style={{ gap: Spacing.element, marginTop: Spacing.micro }}>
              {owingPeople.map((p) => (
                <Pressable
                  key={p.key}
                  disabled={busy}
                  onPress={() => settleWith(p.name)}
                  style={({ pressed }) => [
                    styles.owingRow,
                    {
                      borderColor: p.matched ? colors.mintGreenDark : colors.borderSubtle,
                      backgroundColor: p.matched ? (isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft) : colors.cardSubtle,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.owingName, { color: colors.textPrimary }]}>{p.name}{p.matched ? ' · name matches' : ''}</Text>
                  <Text style={[styles.owingOwed, { color: colors.mintGreenDark }]}>owes {money(p.owed)} → Settle</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!discovery && type === 'expense' && event.direction !== 'credit' ? (
          <AppButton
            label="Save and split with friends"
            variant="outline"
            size="standard"
            icon={<Users size={16} color={colors.textPrimary} />}
            disabled={busy}
            style={{ marginBottom: Spacing.group }}
            onPress={logAndSplit}
          />
        ) : null}
      </ScrollView>
    );

    footer = (
      <View style={{ gap: Spacing.element }}>
        <AppButton
          label={
            discovery
              ? 'Teach Format'
              : categoryOnly
              ? 'Save Category'
              : type === 'income'
              ? `Save as Income · ${money(amount)}`
              : `Save as Expense · ${money(amount)}`
          }
          variant="primary"
          size="cta"
          loading={busy}
          disabled={busy || (needsAmount && !amount) || (categoryOnly && !categoryId)}
          onPress={handleSave}
        />
        <View style={styles.secondaryRow}>
          <Pressable
            hitSlop={{ top: 8, bottom: 12, left: 12, right: 12 }}
            disabled={busy}
            onPress={handleIgnore}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.65 }]}
          >
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
              {discovery ? 'Not a transaction — Ignore' : 'Not a transaction'}
            </Text>
          </Pressable>
          <Text style={[styles.dotSeparator, { color: colors.border }]}>•</Text>
          <Pressable
            hitSlop={{ top: 8, bottom: 12, left: 12, right: 12 }}
            disabled={busy}
            onPress={handleDiscard}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.65 }]}
          >
            <Text style={[styles.secondaryText, { color: colors.peachCoral }]}>
              {categoryOnly ? 'Delete transaction' : 'Discard review'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      colors={colors}
      isDark={isDark}
      avoidKeyboard={needsAmount}
      containerStyle={[styles.modalContainer, { height: sheetHeight }]}
      contentStyle={styles.modalContent}
      footer={
        <View>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          {footer}
        </View>
      }
    >
      {content}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    height: '86%',
    maxHeight: '92%',
  },
  modalContent: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: Spacing.block,
  },
  summary: {
    borderRadius: BorderRadius.input,
    padding: Spacing.block,
    marginBottom: Spacing.group,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
    fontFamily: FontFamily.bold,
  },
  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  discoveryBadgeText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.micro,
  },
  metaMuted: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.micro,
  },
  quoteBox: {
    borderRadius: 10,
    paddingHorizontal: Spacing.element,
    paddingVertical: 6,
    marginTop: Spacing.element,
  },
  quoteText: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption + 2,
    fontFamily: FontFamily.medium,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.group,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.element,
  },
  label: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chosenLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  categoryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingVertical: 2,
  },
  catChip: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: BorderRadius.pill,
  },
  catIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  catChipText: {
    flex: 1,
    fontSize: 13.5,
    includeFontPadding: false,
  },
  catCheckWrapper: {
    marginLeft: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    padding: Spacing.block,
    borderRadius: BorderRadius.input,
    marginBottom: Spacing.group,
  },
  rememberTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    lineHeight: LineHeight.bodySmall,
  },
  rememberSub: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: LineHeight.caption + 2,
    marginTop: 3,
  },
  owingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: BorderRadius.input,
    padding: Spacing.group,
    minHeight: 48,
  },
  owingName: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    flex: 1,
  },
  owingOwed: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    height: ControlHeight.standard,
  },
  rupee: {
    fontSize: FontSize.titleSmall,
    fontFamily: FontFamily.bold,
    marginRight: Spacing.element,
  },
  amountInput: {
    flex: 1,
    fontSize: FontSize.titleSmall,
    fontFamily: FontFamily.bold,
  },
  footerCol: {
    gap: Spacing.group,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.block,
    paddingTop: Spacing.element,
    paddingBottom: Spacing.nano,
  },
  secondaryBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.element,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  secondaryText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.semibold,
  },
  dotSeparator: {
    fontSize: FontSize.bodySmall,
  },
  error: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
    marginBottom: Spacing.micro,
    textAlign: 'center',
  },
  text: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall + 2,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.element,
  },
});

