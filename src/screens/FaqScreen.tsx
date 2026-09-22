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
  HelpCircle, PiggyBank, Flame, Wallet, ShieldCheck, Calendar,
} from 'lucide-react-native';

import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { useTheme } from '../store/themeStore';
import { RootStackParamList } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'Faq'>;
type Category = 'All' | 'Daily Budget' | 'Gullak & Savings' | 'Streak & Rules' | 'Income & Expenses' | 'Offline & Privacy';

const CATEGORIES: Category[] = [
  'All', 'Daily Budget', 'Gullak & Savings', 'Streak & Rules', 'Income & Expenses', 'Offline & Privacy',
];

const ICONS: Record<string, any> = {
  'Daily Budget': Calendar,
  'Gullak & Savings': PiggyBank,
  'Streak & Rules': Flame,
  'Income & Expenses': Wallet,
  'Offline & Privacy': ShieldCheck,
};

const FAQ_DATA = [
  // Daily Budget
  ['db_1', 'Daily Budget', 'When does my Daily Budget renew each day?',
   'If Auto-Renew is turned on, your default daily allowance from your Profile is automatically allocated at midnight (12:00 AM) for the new day.'],
  ['db_2', 'Daily Budget', 'When does a changed Daily Budget take effect?',
   'Your new daily budget takes effect starting tomorrow at 12:00 AM. Today’s active allowance remains unchanged to maintain daily spending discipline and preserve accurate tracking.'],
  ['db_3', 'Daily Budget', 'What happens if I spend less than my Daily Budget?',
   'Any unspent money from your daily allowance automatically rolls over into your Daily Savings Gullak at midnight, building your lifetime savings.'],

  // Gullak & Savings
  ['gs_1', 'Gullak & Savings', 'How does money get deposited into my Gullak?',
   'Money is added to your Gullak in two ways:\n\n1. Automatic Daily Rollover: Unspent daily allowance rolls over automatically every midnight.\n2. Manual Deposit: Tap "Deposit to Gullak" on the Savings screen to deposit custom savings anytime.'],
  ['gs_2', 'Gullak & Savings', 'What happens if I overspend my Daily Budget?',
   'If your expenses exceed your daily budget, the overspent amount is deducted directly from your Gullak balance as an overspending penalty. Your savings for the day become ₹0 and your savings streak resets.'],
  ['gs_3', 'Gullak & Savings', 'How can I delete a Gullak deposit?',
   'On the Savings screen, scroll down to the history section and select the "Deposits" filter. Tap any manual deposit row to remove it.'],

  // Streak & Rules
  ['sr_1', 'Streak & Rules', 'How do savings streaks work and when do they break?',
   '• Increases: Every day you stay within your budget and save money (Saved > 0).\n• Resets to 0: If you exceed your budget, save ₹0 on an active day, or miss tracking on a budgeted day.'],
  ['sr_2', 'Streak & Rules', 'What do the different colors mean on the Streak Calendar?',
   '🟢 Green: Stayed within budget and saved money.\n🔴 Red: Budget exceeded (overspent).\n⚪ Gray: Untracked day (no daily budget was active).'],

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
  const [expandedId, setExpandedId] = useState<string | null>('db_1');

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
