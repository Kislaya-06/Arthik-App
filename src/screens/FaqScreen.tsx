import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Search from 'lucide-react-native/icons/search';
import X from 'lucide-react-native/icons/x';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import Flame from 'lucide-react-native/icons/flame';
import Wallet from 'lucide-react-native/icons/wallet';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Calendar from 'lucide-react-native/icons/calendar';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Zap from 'lucide-react-native/icons/zap';

import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight } from '../config/theme';
import { useTheme } from '../store/themeStore';
import { RootStackParamList } from '../types';
import { configureLayoutAnimation } from '../lib/animationUtils';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';
import { BouncyCategoryFilter } from '../components/BouncyCategoryFilter';
import { ChevronRotator } from '../components/ui/ChevronRotator';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'Faq'>;
type Category = 'All' | 'Budget Modes' | 'Daily Budget' | 'Gullak & Savings' | 'Streak & Rules' | 'Income & Expenses' | 'Automatic Logging' | 'Offline & Privacy';

const CATEGORIES: Category[] = [
  'All', 'Budget Modes', 'Daily Budget', 'Gullak & Savings', 'Streak & Rules', 'Income & Expenses', 'Automatic Logging', 'Offline & Privacy',
];

const ICONS: Record<string, any> = {
  'Budget Modes': Sparkles,
  'Daily Budget': Calendar,
  'Gullak & Savings': PiggyBank,
  'Streak & Rules': Flame,
  'Income & Expenses': Wallet,
  'Automatic Logging': Zap,
  'Offline & Privacy': ShieldCheck,
};

const FAQ_DATA = [
  // Budget Modes
  ['bm_1', 'Budget Modes', 'What is Pure mode?',
   'Pure Mode is a streamlined expense tracker focused solely on tracking your spending and income without spending limits, daily allowances, or Gullak savings. The bottom navigation has 4 tabs and the Home screen shows your overall cashflow with an Inflow/Outflow ring. You can switch to Budget Mode anytime in your Profile.'],
  ['bm_2', 'Budget Modes', 'How do weekly and monthly budgets work?',
   'Instead of a daily allowance, you can set a target budget for the entire week (Monday to Sunday) or calendar month. Your active balance tracks what remains for that period. At the end of the week or month, any unspent budget automatically rolls over into your Savings Gullak.'],
  ['bm_3', 'Budget Modes', 'When does money go to Gullak?',
   'Unspent money rolls over into your Gullak when a budget period ends:\n• Daily: Every midnight (12:00 AM) for yesterday’s savings.\n• Weekly: Every Sunday midnight (11:59:59 PM) for the week’s savings.\n• Monthly: At the end of the last day of each month.\nYou can also deposit custom cash into your Gullak manually anytime from the Savings screen.'],
  ['bm_4', 'Budget Modes', 'What happens when I switch cadence mid-week?',
   'When switching your budget plan (like from Daily to Weekly or Monthly), the change starts tomorrow at 12:00 AM. In Arthik, every rupee is real money. Your full budget is available right away without any cuts or deductions, and any unspent money rolls into your Gullak when the cycle ends.'],
  ['bm_5', 'Budget Modes', 'Is my Gullak safe if I turn Budget Mode off?',
   'Yes, 100%! All money in your Gullak represents real accumulated savings and is permanently preserved in your account. Turning Budget Mode off simply hides the Savings tab and pauses active budget tracking. Whenever you re-enable Budget Mode, your Gullak balance, deposit history, and past savings remain intact.'],

  // Daily Budget
  ['db_1', 'Daily Budget', 'When does my Daily Budget renew each day?',
   'If Auto-Renew is turned on in Daily cadence, your default daily allowance from your Profile is automatically allocated at midnight (12:00 AM) for the new day.'],
  ['db_2', 'Daily Budget', 'When does a changed Daily Budget take effect?',
   'Your new daily budget takes effect starting tomorrow at 12:00 AM. Today’s active allowance remains unchanged to maintain daily spending discipline and preserve accurate tracking.'],
  ['db_3', 'Daily Budget', 'What happens if I spend less than my Daily Budget?',
   'Any unspent money from your daily allowance automatically rolls over into your Daily Savings Gullak at midnight, building your lifetime savings.'],

  // Gullak & Savings
  ['gs_1', 'Gullak & Savings', 'How does money get deposited into my Gullak?',
   'Money is added to your Gullak in two ways:\n\n1. Automatic Period Rollover: Unspent funds roll over automatically at the end of your active period (daily at midnight, weekly on Sunday night, or monthly on the last day).\n2. Manual Deposit: Tap "Deposit to Gullak" on the Savings screen to deposit custom savings anytime.'],
  ['gs_2', 'Gullak & Savings', 'What happens if I overspend my Daily Budget?',
   'If your expenses exceed your budget allowance, the overspent amount is deducted directly from your Gullak balance as an overspending penalty. Your savings for that period become ₹0 and your savings streak resets.'],
  ['gs_3', 'Gullak & Savings', 'How can I delete a Gullak deposit?',
   'On the Savings screen, scroll down to the history section and select the "Deposits" filter. Tap any manual deposit row to remove it.'],

  // Streak & Rules
  ['sr_1', 'Streak & Rules', 'How do savings streaks work and when do they break?',
   '• Increases: Every finalized period (day, week, or month) you stay within your budget and save money (Saved > 0).\n• Resets to 0: If you exceed your budget, save ₹0 on an active period, or miss tracking during an active budget.'],
  ['sr_2', 'Streak & Rules', 'What do the different colors mean on the Streak Calendar?',
   '🟢 Green: Stayed within budget and saved money.\n🔴 Red: Budget exceeded (overspent).\n⚪ Gray: Untracked or paused period (no budget was active).'],

  // Income & Expenses
  ['ie_1', 'Income & Expenses', 'Why does adding Income not increase my Daily Budget?',
   'The Daily Budget is a fixed daily spending allowance designed for disciplined spending. Income flows into your total cash balance and net savings, rather than inflating your daily spending limit.'],
  ['ie_2', 'Income & Expenses', 'Why is the "Card" option unavailable when adding Income?',
   'Card accounts are for incurring expenses. Income can only be received via Cash or Bank / UPI accounts.'],
  ['ie_3', 'Income & Expenses', 'Can I add an expense for a past date?',
   'Yes! Tap the date field on the Add Transaction screen to pick any past date. The app will automatically recalculate past allowances, savings, and streaks.'],

  // Automatic Logging
  ['al_1', 'Automatic Logging', 'What is Automatic Logging (Beta)?',
   'Automatic Logging is in Beta and is being rolled out gradually, starting with people who used Arthik before v2.0. Arthik reads bank transaction SMS and payment notifications (Google Pay, PhonePe, Paytm and more) on your phone and turns them into transactions for you. Turn it on from Profile → Automatic Logging. You choose which bank accounts are tracked.'],
  ['al_2', 'Automatic Logging', 'Will my old messages be added as transactions?',
   'No. During setup Arthik reads old messages only to learn your banks, accounts and message formats (Discovery). Nothing from before setup is ever added to your history.'],
  ['al_3', 'Automatic Logging', 'Are my SMS uploaded anywhere?',
   'No. Detection happens entirely on your phone, in an encrypted local database. Personal SMS and OTPs are dropped before processing. Only "Automatic Logging is on" plus bank name and last 4 digits of tracked accounts are saved to your account, so Arthik can notice a re-install.'],
  ['al_4', 'Automatic Logging', 'Why is a payment in Pending Review instead of logged?',
   'Arthik never guesses. Money received from a person, a payment app notification without a matching bank SMS, an unreadable message, or something that looks like an entry you already added will wait for you to decide.'],
  ['al_5', 'Automatic Logging', 'What happens when I sign out?',
   'Automatic Logging stops. When you sign in again you choose: recover missed transactions from that period, or only learn from it. If the app was uninstalled or its data was cleared, setup starts fresh and that period is never added.'],
  ['al_6', 'Automatic Logging', 'Transactions are not detected when the app is closed',
   'Your phone may be limiting Arthik in the background. Open Automatic Logging → Background access → Fix and set Battery usage to Unrestricted. On some phones also enable "Autostart" for Arthik.'],
  ['al_7', 'Automatic Logging', 'Can Arthik detect transactions from bank emails?',
   'Yes (Arthik 2.1+). Turn on Automatic Logging → Email notifications. Arthik reads only bank and payment email notifications shown by Gmail, Outlook and other supported email apps, on your phone. Personal, OTP, login and promotional emails are not used, and old emails are never imported.'],
  ['al_8', 'Automatic Logging', 'Will the same payment be added twice if I get an SMS, a notification and an email?',
   'No. Arthik checks whether a new message describes a payment it already has — by the transaction reference, or by amount, account and merchant — even if the email arrives hours later. They become one transaction with all sources listed. If a message could match more than one payment, it waits in Pending Review instead of guessing.'],

  // Offline & Privacy
  ['op_1', 'Offline & Privacy', 'Does the app work without an internet connection?',
   'Yes! Arthik is fully offline-first. All your transactions and edits are saved locally on your device and automatically sync to the cloud as soon as an internet connection is available.'],
  ['op_2', 'Offline & Privacy', 'What happens to unsynced data if I log out?',
   'If you have unsynced entries, the app warns you before logging out. Unsynced data stays safely queued on your device until you log back into the same account.'],
  ['op_3', 'Offline & Privacy', 'How does App Lock work? Does Arthik store my biometric data?',
   'No. Arthik uses your device’s native hardware biometric security (Fingerprint / Face Unlock / PIN). Your biometric credentials never leave your device’s secure hardware enclave.'],
  ['op_4', 'Offline & Privacy', 'What happens when I delete my account?',
   'Deleting your account from the Profile screen permanently deletes all your expenses, categories, and Gullak savings history from both your device and cloud servers. This action is irreversible.'],
].map(([id, category, question, answer]) => ({ id, category: category as Category, question, answer }));

/** Topic filter options: "All" + every category, in the order above (same pill filter as History). */
const TOPIC_OPTIONS = CATEGORIES.map((c) => ({ id: c === 'All' ? null : c, name: c }));

/**
 * FAQs & Help, laid out like a help centre (Swiggy / Zomato style, in Arthik's own tokens):
 * search, the topic pill filter, then one inset card per topic with its questions separated by hairlines.
 * A question opens in place; the chevron turns to show it. Nothing is open until the user asks.
 */
export const FaqScreen: React.FC<Props> = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<Category>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    configureLayoutAnimation(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const faqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FAQ_DATA.filter((item) => {
      if (selectedCat !== 'All' && item.category !== selectedCat) return false;
      return !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
  }, [search, selectedCat]);

  // One group per topic, in the topic order; empty topics are skipped.
  const groups = useMemo(
    () =>
      CATEGORIES.filter((c) => c !== 'All')
        .map((category) => ({ category, items: faqs.filter((f) => f.category === category) }))
        .filter((g) => g.items.length > 0),
    [faqs]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScreenHeader title="FAQs & Help" />

      {/* Search: same 48dp field as the app's other search bars */}
      <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search questions"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search questions"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <PressableOpacity activeOpacity={PRESS_DIM_OPACITY} accessibilityRole="button" accessibilityLabel="Clear search text" onPress={() => setSearch('')} hitSlop={12}>
            <X size={18} color={colors.textSecondary} />
          </PressableOpacity>
        )}
      </View>

      {/* Topics: the same sliding pill filter as History */}
      <View style={styles.filterWrapper}>
        <BouncyCategoryFilter
          options={TOPIC_OPTIONS}
          value={selectedCat === 'All' ? null : selectedCat}
          onChange={(id) => {
            setExpandedId(null);
            setSelectedCat((id ?? 'All') as Category);
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.section }]}
        showsVerticalScrollIndicator={false}
        // Search keyboard open: the first tap opens a question, and scrolling closes the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {groups.length === 0 ? (
          <EmptyState
            size="section"
            icon={HelpCircle}
            title="No FAQs found"
            subtitle="No questions found matching your search. Try a different keyword."
            style={styles.empty}
          />
        ) : (
          groups.map((group) => {
            const Icon = ICONS[group.category] || HelpCircle;
            return (
              <View key={group.category} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Icon size={16} color={colors.textSecondary} />
                  <Text style={[styles.groupTitle, { color: colors.textSecondary }]} accessibilityRole="header">
                    {group.category}
                  </Text>
                </View>

                <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  {group.items.map((item, index) => {
                    const open = expandedId === item.id;
                    return (
                      <View
                        key={item.id}
                        style={index > 0 ? [styles.rowDivider, { borderTopColor: colors.borderSubtle }] : undefined}
                      >
                        <PressableOpacity
                          activeOpacity={PRESS_DIM_OPACITY}
                          onPress={() => toggleExpand(item.id)}
                          style={styles.questionRow}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: open }}
                          accessibilityLabel={item.question}
                        >
                          <Text style={[styles.question, { color: colors.textPrimary }]}>{item.question}</Text>
                          <ChevronRotator isOpen={open} color={colors.textSecondary} reduceMotion={reduceMotion} />
                        </PressableOpacity>
                        {open ? (
                          <Text style={[styles.answer, { color: colors.textSecondary }]}>{item.answer}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginHorizontal: Spacing.gutter,
    paddingHorizontal: Spacing.surface,
    height: ControlHeight.standard,
    borderRadius: BorderRadius.pill,
  },
  searchInput: { flex: 1, fontSize: FontSize.body, fontFamily: FontFamily.medium, paddingVertical: 0 },
  filterWrapper: { marginTop: Spacing.block, marginBottom: Spacing.element, marginHorizontal: Spacing.gutter },
  listContent: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.element, gap: Spacing.gutter },
  group: { gap: Spacing.group },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element, paddingHorizontal: Spacing.micro },
  groupTitle: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall, fontFamily: FontFamily.bold },
  groupCard: { borderRadius: BorderRadius.card, borderWidth: 1, overflow: 'hidden' },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    minHeight: ControlHeight.row,
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.row,
  },
  question: { flex: 1, fontSize: FontSize.body, lineHeight: LineHeight.body, fontFamily: FontFamily.semibold },
  answer: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.body,
    fontFamily: FontFamily.medium,
    paddingHorizontal: Spacing.surface,
    paddingBottom: Spacing.surface,
    marginTop: -Spacing.micro,
  },
  empty: { paddingVertical: 48, paddingHorizontal: Spacing.gutter },
});
