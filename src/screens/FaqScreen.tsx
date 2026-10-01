import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft, Search, X, ChevronDown, ChevronUp,
  HelpCircle, PiggyBank, Flame, Wallet, ShieldCheck, Calendar, Sparkles,
} from 'lucide-react-native';

import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { useTheme } from '../store/themeStore';
import { RootStackParamList } from '../types';
import { configureLayoutAnimation } from '../lib/animationUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Faq'>;
type Category = 'All' | 'Budget Modes' | 'Daily Budget' | 'Gullak & Savings' | 'Streak & Rules' | 'Income & Expenses' | 'Offline & Privacy';

const CATEGORIES: Category[] = [
  'All', 'Budget Modes', 'Daily Budget', 'Gullak & Savings', 'Streak & Rules', 'Income & Expenses', 'Offline & Privacy',
];

const ICONS: Record<string, any> = {
  'Budget Modes': Sparkles,
  'Daily Budget': Calendar,
  'Gullak & Savings': PiggyBank,
  'Streak & Rules': Flame,
  'Income & Expenses': Wallet,
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
   'When switching between cadences (e.g. from Daily to Weekly, or Weekly to Monthly), the change takes effect starting tomorrow at 12:00 AM. In Arthik, every rupee is real money. Your entered budget is never prorated or scaled down mid-period. The full amount is active immediately, and unspent money rolls into Gullak when the cycle naturally completes.'],
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

export const FaqScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<Category>('All');
  const [expandedId, setExpandedId] = useState<string | null>('bm_1');

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={28} color={colors.textPrimary} strokeWidth={2.5} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          FAQs & Help
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: Spacing.element }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}
          placeholder="Search questions or keywords..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Category Filter Pills */}
      <View style={{ marginBottom: Spacing.element }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {CATEGORIES.map((cat) => {
            const active = selectedCat === cat;
            return (
              <Pressable
                key={cat}
                style={[
                  styles.pill,
                  active
                    ? { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }
                    : { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                ]}
                onPress={() => setSelectedCat(cat)}
              >
                <Text style={[styles.pillText, { color: active ? colors.mintGreenDark : colors.textSecondary, fontFamily: active ? FontFamily.bold : FontFamily.medium }]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Accordion FAQ List */}
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.section }]}
        showsVerticalScrollIndicator={false}
      >
        {faqs.length === 0 ? (
          <View style={styles.empty}>
            <HelpCircle size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>No FAQs found</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              No questions found matching your search. Try a different keyword.
            </Text>
          </View>
        ) : (
          faqs.map((item) => {
            const open = expandedId === item.id;
            const Icon = ICONS[item.category] || HelpCircle;
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: open ? colors.mintGreen : colors.border, borderWidth: isDark || open ? 1 : 0 },
                ]}
                onPress={() => toggleExpand(item.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: Spacing.element }}>
                    <View style={[styles.badge, { backgroundColor: colors.cardSubtle }]}>
                      <Icon size={12} color={colors.mintGreenDark} />
                      <Text style={[styles.badgeText, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
                        {item.category}
                      </Text>
                    </View>
                    <Text style={[styles.qText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                      {item.question}
                    </Text>
                  </View>
                  <View style={[styles.chevron, { backgroundColor: colors.cardSubtle }]}>
                    {open ? <ChevronUp size={16} color={colors.textPrimary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
                  </View>
                </View>

                {open && (
                  <View style={[styles.answerBox, { borderTopColor: colors.borderSubtle }]}>
                    <Text style={[styles.aText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                      {item.answer}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.block, marginBottom: Spacing.element, gap: Spacing.block },
  title: { fontSize: FontSize.screenTitle },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.gutter, paddingHorizontal: Spacing.element, height: 42, borderRadius: BorderRadius.pill, marginBottom: Spacing.element, elevation: 1 },
  searchInput: { flex: 1, fontSize: FontSize.body, paddingVertical: 0 },
  pillsScroll: { paddingHorizontal: Spacing.gutter, gap: Spacing.micro },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.pill, borderWidth: 1 },
  pillText: { fontSize: FontSize.caption },
  listContent: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.micro },
  card: { borderRadius: BorderRadius.card, padding: Spacing.block, marginBottom: Spacing.element, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginBottom: 5, gap: 4 },
  badgeText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  qText: { fontSize: 14, lineHeight: 20 },
  chevron: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  answerBox: { borderTopWidth: 1, marginTop: Spacing.element, paddingTop: Spacing.element },
  aText: { fontSize: 13, lineHeight: 19 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.gutter },
  emptyTitle: { fontSize: FontSize.sectionTitle, marginTop: Spacing.block, marginBottom: 4 },
  emptyDesc: { fontSize: FontSize.bodySmall, textAlign: 'center' },
});
