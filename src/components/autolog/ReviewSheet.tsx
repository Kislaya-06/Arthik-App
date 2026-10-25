import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Users from 'lucide-react-native/icons/users';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { SegmentedControl, SegmentedOption } from '../ui/SegmentedControl';
import { Checkbox } from './AutoLogUi';
import { useTheme } from '../../store/themeStore';
import { useCategoryStore, Category, categoriesOfKind } from '../../store/categoryStore';
import { getCategoryIcon } from '../../lib/iconUtils';
import { getCategoryChipGradient } from '../../lib/colorUtils';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight, Motion } from '../../config/theme';
import type { AutoLogEvent, TrackedAccount } from '../../features/autoLog/types';
import { accountLabelFromKey, dateTime, eventTitle, money } from '../../features/autoLog/copy';
import { useExpenseStore } from '../../store/expenseStore';
import { navigationRef } from '../../navigation/navigationRef';
import { convertIncomeToMoneyBack } from '../../store/expense/moneyBack';
import { buildPeopleLedger, matchIncomingToPeople } from '../../lib/splitLedger';
import { settleButtonLabel, settleNote, settlingButtonLabel, summarizeSettle } from '../../lib/settleReview';
import {
  classifyEvent,
  setEventCategory,
  ignoreEvent,
  learnFromDiscovery,
  resolveDuplicate,
  resolveTransfer,
  discardEvent,
  markAsSelfTransfer,
} from '../../features/autoLog/reviews';

/**
 * Concise single-sheet AutoLog review (Spec §9, §18-21).
 * Features:
 * - Compact fintech split-row receipt (left: Amount + Merchant, right: Account pill + Date/Source).
 * - Horizontal category scroll with left/right fade gradients (matching Add Transaction / ExpenseFormScreen).
 * - 48px stadium pill for Remember Preference.
 * - 48px stadium pill button for "Mark as Self Transfer" (automates transfer rule & purges expense).
 * - 48px stadium pill button for "Save and split with friends".
 * - Primary 52px CTA with comfortable 38px auxiliary actions below.
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
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

// ─── Animated Category Chip (Parity with ExpenseFormScreen) ──────────────────
const CategoryChipItem: React.FC<{
  category: Category;
  isSelected: boolean;
  onSelect: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}> = ({ category, isSelected, onSelect, colors, isDark }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const IconComp = getCategoryIcon(category.icon);

  useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: Motion.scale.chip, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: Motion.springs.release.tension, friction: Motion.springs.release.friction, useNativeDriver: true }),
      ]).start();
    }
  }, [isSelected, scale]);

  const chipColor = category.color || colors.mintGreen;

  const { startColor, midColor, endColor, contentColor } = useMemo(() => {
    if (!isSelected) {
      return {
        startColor: '',
        midColor: '',
        endColor: '',
        contentColor: colors.textPrimary,
      };
    }
    return getCategoryChipGradient(chipColor, isDark);
  }, [chipColor, isSelected, isDark, colors.textPrimary]);

  const gradId = `review_chip_grad_${(category.id || 'default').replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Pressable onPress={onSelect}>
      <Animated.View
        style={[
          styles.categoryChip,
          isSelected
            ? { backgroundColor: midColor, borderColor: midColor }
            : { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle },
          { transform: [{ scale }] },
        ]}
      >
        {isSelected && (
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradId} x1="10%" y1="0%" x2="90%" y2="100%">
                <Stop offset="0%" stopColor={startColor} />
                <Stop offset="50%" stopColor={midColor} />
                <Stop offset="100%" stopColor={endColor} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={21} ry={21} fill={`url(#${gradId})`} />
          </Svg>
        )}
        <IconComp size={15} color={contentColor} strokeWidth={isSelected ? 2.2 : 2.0} />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.categoryChipText, { color: contentColor, fontFamily: FontFamily.bold }]}
        >
          {category.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export const ReviewSheet: React.FC<Props> = ({
  visible,
  event,
  accounts,
  discovery = false,
  onClose,
  onDone,
}) => {
  const { colors, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const categories = useCategoryStore((s) => s.categories);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  /** The person whose payback is being saved right now (button label while saving). */
  const [settlingWith, setSettlingWith] = useState<string | null>(null);
  /**
   * The person the user CHOSE as the payer (SPL-005). Nothing is chosen automatically, not even a likely match:
   * the footer button only turns into "Settle with …" after the user taps a person, and saving as income stays the
   * default until then.
   */
  const [pickedPersonKey, setPickedPersonKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryOnly = !!event && event.status === 'logged' && event.needsCategory;
  const sheetHeight = Math.min(Math.round(windowHeight * 0.86), 740);

  useEffect(() => {
    if (visible && event) {
      setType(event.direction === 'credit' ? 'income' : 'expense');
      setCategoryId(null);
      setRemember(false);
      setAmountText('');
      setError(null);
      setBusy(false);
      setSettlingWith(null);
      setPickedPersonKey(null);
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

  // Only categories of the chosen side: income categories for income, expense categories for expenses (CAT-004).
  const usableCategories = useMemo(
    () => categoriesOfKind(categories.filter((c) => !c.isPlaceholder), type),
    [categories, type]
  );
  const chosenCategory = usableCategories.find((c) => c.id === categoryId);
  const account = event ? accountLabelFromKey(event.accountKey, accounts) : null;
  const needsAmount = !discovery && !!event && event.amount == null;
  const typedAmount = Number(amountText.replace(/,/g, ''));
  const amount = needsAmount
    ? Number.isFinite(typedAmount) && typedAmount > 0
      ? typedAmount
      : null
    : event?.amount ?? null;

  // The chosen payer (only while this is an income and the person still owes money).
  const pickedPerson =
    type === 'income' && pickedPersonKey ? owingPeople.find((p) => p.key === pickedPersonKey) ?? null : null;
  const settleSummary = pickedPerson ? summarizeSettle(pickedPerson.owed, amount) : null;
  const settleHint = pickedPerson && settleSummary ? settleNote(pickedPerson.name, settleSummary, money) : null;

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
    // A person was chosen: the footer button settles their payback (it is never saved as income).
    if (pickedPerson && !discovery) {
      return settleWith(pickedPerson.name);
    }
    // Every saved transaction needs a category. Saving without one would log it with needsCategory = true
    // and send it straight back to review, so the review could never be finished.
    if (!discovery && !categoryId) {
      setError('Please select a category.');
      return;
    }
    if (categoryOnly && categoryId) {
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

  const handleSelfTransfer = () => {
    Alert.alert(
      'Mark as self transfer?',
      `This transaction will not be counted as an expense or income${event.merchant ? `, and future transfers for "${event.merchant}" will be remembered` : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Transfer',
          onPress: () => run(() => markAsSelfTransfer(event, remember), 'Marked as self transfer'),
        },
      ]
    );
  };

  const settleWith = (personName: string) => {
    setSettlingWith(personName);
    return run(async () => {
      // A payback has no category of its own: the money goes back to the categories of the expenses it settles
      // (oldest first, SPL-003). So this review is finished now and must not ask for a category again.
      const logged = await classifyEvent(
        event,
        'income',
        null,
        false,
        needsAmount ? amount ?? undefined : undefined,
        { clearNeedsCategory: true }
      );
      if (!logged.expenseId) throw new Error('Could not log this payment. Please try again.');
      await convertIncomeToMoneyBack({ incomeId: logged.expenseId, kind: 'settlement', who: personName });
    }, `${personName} paid back ${money(amount)}`).finally(() => setSettlingWith(null));
  };

  const logAndSplit = () => {
    if (needsAmount && !amount) {
      setError('Enter the amount first.');
      return;
    }
    return run(async () => {
      const logged = await classifyEvent(
        event,
        'expense',
        categoryId,
        remember,
        needsAmount ? amount ?? undefined : undefined,
        { clearNeedsCategory: true }
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

  // ── Split-Row Receipt Summary Card (Zero void space, compact layout) ──
  const summary = (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: colors.cardSubtle,
          borderColor: colors.borderSubtle,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <View style={styles.summarySplitRow}>
        <View style={styles.summaryLeftCol}>
          <Text style={[styles.summaryAmount, { color: colors.textPrimary }]} numberOfLines={1}>
            {money(amount)}
          </Text>
          <Text
            style={[styles.summaryMerchant, { color: colors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {eventTitle(event)}
          </Text>
        </View>

        <View style={styles.summaryRightCol}>
          {account ? (
            <View
              style={[
                styles.accountPill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text
                style={[styles.accountPillText, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {account}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.summaryDateText, { color: colors.textSecondary }]} numberOfLines={1}>
            {[
              dateTime(event.occurredAt),
              event.source === 'notification'
                ? 'Notification'
                : event.source === 'email'
                ? 'Email'
                : 'SMS',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      {discovery ? (
        <View style={[styles.discoveryBadge, { backgroundColor: colors.mintGreenSoft }]}>
          <ShieldCheck size={12} color={colors.mintGreenDark} />
          <Text style={[styles.discoveryBadgeText, { color: colors.mintGreenDark }]}>Discovery</Text>
        </View>
      ) : null}

      {event.body ? (
        <View
          style={[
            styles.summaryQuoteBox,
            {
              backgroundColor: colors.background,
              borderColor: colors.borderSubtle,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <Text
            style={[styles.summaryQuoteText, { color: colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            "{event.body.replace(/\s+/g, ' ').trim()}"
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
        <AppButton
          label="Yes, my own transfer"
          variant="secondary"
          size="standard"
          loading={busy}
          onPress={() => run(() => resolveTransfer(event, true), 'Marked as a transfer')}
        />
        <AppButton
          label="No, a separate payment"
          variant="outline"
          size="standard"
          disabled={busy}
          onPress={() => run(() => resolveTransfer(event, false), 'Logged as a separate payment')}
        />
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
        <AppButton
          label="Yes, same payment — don't add"
          variant="secondary"
          size="standard"
          loading={busy}
          onPress={() => run(() => resolveDuplicate(event, true), 'Kept your manual entry')}
        />
        <AppButton
          label="No, it's a different payment"
          variant="outline"
          size="standard"
          disabled={busy}
          onPress={() => run(() => resolveDuplicate(event, false), 'Logged as a separate transaction')}
        />
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
                // The chosen category belongs to the other side now, so it is cleared.
                if (k !== type) setCategoryId(null);
                if (k !== 'income') setPickedPersonKey(null);
              }}
              height={ControlHeight.standard}
              activePillColor={type === 'expense' ? colors.peachCoral : colors.mintGreen}
              activeTextColor={colors.forestGreen}
              backgroundColor={colors.inputBg}
              fontSize={FontSize.bodySmall}
            />
          </View>
        ) : null}

        {/* ── Category Section: Horizontal Scroll with Left/Right Fade Gradients ── */}
        <View style={[styles.categorySection, pickedPerson && styles.dimmedSection]} pointerEvents={pickedPerson ? 'none' : 'auto'}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>CATEGORY</Text>
            {chosenCategory ? (
              <Text style={[styles.chosenLabel, { color: colors.mintGreenDark }]}>
                {chosenCategory.name}
              </Text>
            ) : null}
          </View>

          <View style={styles.categoryScrollContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.categoryList}
            >
              {usableCategories.length === 0 ? (
                <Text style={[styles.chosenLabel, { color: colors.textSecondary }]}>
                  {type === 'income'
                    ? 'No income categories yet. Add one in Manage Categories.'
                    : 'No expense categories yet. Add one in Manage Categories.'}
                </Text>
              ) : null}
              {usableCategories.map((cat: Category) => {
                const isSelected = categoryId === cat.id;
                return (
                  <CategoryChipItem
                    key={cat.id}
                    category={cat}
                    isSelected={isSelected}
                    onSelect={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setCategoryId(isSelected ? null : cat.id);
                    }}
                    colors={colors}
                    isDark={isDark}
                  />
                );
              })}
            </ScrollView>

            {/* Left Fade Overlay */}
            <View pointerEvents="none" style={styles.categoryFadeLeft}>
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="reviewCategoryFadeLeft" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.card} stopOpacity="1" />
                    <Stop offset="0.5" stopColor={colors.card} stopOpacity="0.8" />
                    <Stop offset="1" stopColor={colors.card} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#reviewCategoryFadeLeft)" />
              </Svg>
            </View>

            {/* Right Fade Overlay */}
            <View pointerEvents="none" style={styles.categoryFadeRight}>
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="reviewCategoryFadeRight" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.card} stopOpacity="0" />
                    <Stop offset="0.5" stopColor={colors.card} stopOpacity="0.8" />
                    <Stop offset="1" stopColor={colors.card} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#reviewCategoryFadeRight)" />
              </Svg>
            </View>
          </View>
        </View>

        {/* ── Remember Preference 48px Stadium Pill ── */}
        <Pressable
          disabled={!!pickedPerson}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setRemember((r) => !r);
          }}
          style={({ pressed }) => [
            styles.rememberPill,
            pickedPerson && styles.dimmedSection,
            {
              backgroundColor: remember
                ? isDark
                  ? 'rgba(184, 224, 200, 0.12)'
                  : colors.mintGreenSoft
                : colors.cardSubtle,
              borderColor: remember ? colors.mintGreenDark : colors.borderSubtle,
              borderWidth: remember ? 1.5 : 1,
            },
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
        >
          <Checkbox checked={remember} />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.rememberText,
              {
                color: colors.textPrimary,
                fontFamily: remember ? FontFamily.bold : FontFamily.semibold,
              },
            ]}
          >
            {event.merchant
              ? `Remember preference for "${event.merchant}"`
              : 'Remember this preference'}
          </Text>
        </Pressable>

        {/* ── Paid back by someone (if income and people owe money) ──
            Nothing here is selected by itself. A likely match only gets a small tag; the user taps a person to
            choose them, and the footer button then settles instead of saving income (SPL-005). */}
        {owingPeople.length > 0 && type === 'income' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PAID BACK BY SOMEONE?</Text>
            <View style={{ gap: Spacing.element }}>
              {owingPeople.map((p) => {
                const picked = pickedPersonKey === p.key;
                return (
                  <Pressable
                    key={p.key}
                    disabled={busy}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setError(null);
                      setPickedPersonKey(picked ? null : p.key);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: picked, disabled: busy }}
                    accessibilityLabel={`${p.name}, owes ${money(p.owed)}${p.matched ? ', likely match' : ''}`}
                    style={({ pressed }) => [
                      styles.owingRow,
                      {
                        borderColor: picked ? colors.mintGreenDark : colors.borderSubtle,
                        backgroundColor: picked
                          ? isDark
                            ? 'rgba(184, 224, 200, 0.12)'
                            : colors.mintGreenSoft
                          : colors.cardSubtle,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Checkbox checked={picked} />
                    <View style={styles.owingTextCol}>
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.owingName, { color: colors.textPrimary }]}
                      >
                        {p.name}
                      </Text>
                      {p.matched ? (
                        <View
                          style={[
                            styles.likelyTag,
                            { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.14)' : colors.mintGreenSoft },
                          ]}
                        >
                          <Text style={[styles.likelyTagText, { color: colors.mintGreenDark }]}>Likely match</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={[styles.owingOwed, { color: colors.textSecondary }]}>
                      owes {money(p.owed)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Action Stadium Pills (Mark as Self Transfer & Split) ── */}
        {!discovery ? (
          <View style={styles.actionPillsGroup}>
            <AppButton
              label="Mark as Self Transfer"
              variant="outline"
              size="standard"
              icon={<ArrowLeftRight size={16} color={colors.textPrimary} />}
              disabled={busy}
              onPress={handleSelfTransfer}
            />

            {type === 'expense' && event.direction !== 'credit' ? (
              <AppButton
                label="Save and split with friends"
                variant="outline"
                size="standard"
                icon={<Users size={16} color={colors.textPrimary} />}
                disabled={busy}
                onPress={logAndSplit}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    );

    footer = (
      <View style={{ gap: Spacing.element }}>
        {settleHint && !busy ? (
          <Text numberOfLines={1} style={[styles.settleNote, { color: colors.textSecondary }]}>
            {settleHint}
          </Text>
        ) : null}
        <AppButton
          label={
            discovery
              ? 'Teach Format'
              : settlingWith && pickedPerson && settleSummary
              ? settlingButtonLabel(pickedPerson.name, settleSummary.settles, money)
              : pickedPerson && settleSummary
              ? settleButtonLabel(pickedPerson.name, settleSummary.settles, money)
              : categoryOnly
              ? 'Save Category'
              : type === 'income'
              ? `Save as Income · ${money(amount)}`
              : `Save as Expense · ${money(amount)}`
          }
          variant="primary"
          size="cta"
          loading={busy}
          disabled={busy || (needsAmount && !amount) || (!discovery && !categoryId && !pickedPerson)}
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
  // ── Split-row Receipt Summary Card ──
  summaryCard: {
    borderRadius: BorderRadius.input,
    padding: Spacing.group,
    marginBottom: Spacing.group,
  },
  summarySplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeftCol: {
    flex: 1,
    marginRight: Spacing.element,
  },
  summaryAmount: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  summaryMerchant: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    marginTop: 2,
  },
  summaryRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  accountPill: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    maxWidth: 150,
  },
  accountPillText: {
    fontSize: FontSize.caption - 1,
    fontFamily: FontFamily.bold,
  },
  summaryDateText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: 4,
  },
  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.micro,
    alignSelf: 'flex-start',
  },
  discoveryBadgeText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryQuoteBox: {
    borderRadius: 8,
    paddingHorizontal: Spacing.element,
    paddingVertical: 5,
    marginTop: 8,
  },
  summaryQuoteText: {
    fontSize: FontSize.caption - 1,
    fontFamily: FontFamily.medium,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.group,
  },
  categorySection: {
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
    marginBottom: Spacing.element,
  },
  chosenLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  // ── Horizontal category scroll & fade styles ──
  categoryScrollContainer: {
    position: 'relative',
    marginHorizontal: -Spacing.gutter,
  },
  categoryList: {
    flexDirection: 'row',
    gap: Spacing.element,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: 2,
  },
  categoryFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
  categoryFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.block,
    paddingVertical: 10,
    borderWidth: 1,
    overflow: 'hidden',
    height: 42,
  },
  categoryChipText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
    includeFontPadding: false,
  },
  // ── 48px Uniform Stadium Pills ──
  rememberPill: {
    height: ControlHeight.standard,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.block,
    gap: Spacing.element,
    marginBottom: Spacing.group,
  },
  rememberText: {
    flex: 1,
    fontSize: FontSize.bodySmall,
    includeFontPadding: false,
  },
  actionPillsGroup: {
    gap: Spacing.element,
    marginBottom: Spacing.group,
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
  owingTextCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: Spacing.element + 2,
    marginRight: Spacing.element,
    gap: 3,
    alignItems: 'flex-start',
  },
  owingName: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    maxWidth: '100%',
  },
  owingOwed: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    flexShrink: 0,
  },
  likelyTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  likelyTagText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.2,
  },
  settleNote: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
    textAlign: 'center',
  },
  dimmedSection: {
    opacity: 0.4,
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
    paddingVertical: 8,
    paddingHorizontal: Spacing.element,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
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
