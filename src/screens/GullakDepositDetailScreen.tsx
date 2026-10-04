import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { AmountText } from '../components/ui/AmountText';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AppButton } from '../components/ui/AppButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GullakDepositDetail'>;

export const GullakDepositDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { depositId } = route.params;
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const removeGullakDeposit = useDailyBudgetStore((s) => s.removeGullakDeposit);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const deposit = gullakDeposits.find((d) => d.id === depositId);

  if (!deposit) {
    return (
      <View style={[styles.notFoundContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={[styles.notFoundText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          Deposit not found
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButtonFallback, { backgroundColor: colors.mintGreenSoft }]}>
          <Text style={[styles.backButtonText, { color: colors.mintGreenDark, fontFamily: FontFamily.bold }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Remove Deposit',
      `Are you sure you want to remove ${formatCurrency(deposit.amount)} from your Gullak?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeGullakDeposit(deposit.id);
            if (navigation.canGoBack()) navigation.goBack();
          },
        },
      ]
    );
  };

  let formattedDate = deposit.date;
  try {
    formattedDate = format(parseISO(deposit.date), 'EEEE, d MMMM yyyy');
  } catch { /* fallback to raw */ }

  const sourceLabel = deposit.source === 'income' ? 'From Income' : 'External Deposit';
  const sourceDescription = deposit.source === 'income'
    ? 'This amount was moved from your tracked income into your Gullak savings.'
    : 'This is fresh money added from outside the app into your Gullak savings.';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.element }]}>
        <Pressable
          onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Deposit Details</Text>
        {/* Spacer to balance back button */}
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          <View style={{ marginBottom: Spacing.block }}>
            <GradientIconBadge size={80} color="#ADEBB3" isDark={isDark}>
              {({ iconColor }) => <PiggyBankCoinIcon size={38} color={iconColor} />}
            </GradientIconBadge>
          </View>
          <View style={styles.currencyRow}>
            <AmountText
              role="hero"
              value={deposit.amount}
              direction="income"
              showDecimals={deposit.amount % 1 !== 0}
            />
          </View>
          <View style={{ marginTop: Spacing.element, alignItems: 'center' }}>
            <StatusBadge
              variant={deposit.source === 'income' ? 'success' : 'warning'}
              label={sourceLabel}
            />
          </View>
        </View>

        {/* Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          {/* Date */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{formattedDate}</Text>
          </View>

          {/* Source */}
          <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Source</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{sourceLabel}</Text>
          </View>

          {/* Note */}
          {deposit.note ? (
            <>
              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Note</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{deposit.note}</Text>
              </View>
            </>
          ) : null}

          {/* Source Description */}
          <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sourceDesc, { color: colors.textSecondary }]}>
            {sourceDescription}
          </Text>
        </View>

        {/* Delete Button */}
        <AppButton
          label="Remove from Gullak"
          onPress={handleDelete}
          variant="danger"
          size="cta"
          icon={<Trash2 size={18} color="#FFFFFF" />}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    paddingBottom: Spacing.block,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
  },
  heroCard: {
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.gutter,
    alignItems: 'center',
    marginBottom: Spacing.block,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.block,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.element,
  },
  sourceBadge: {
    paddingHorizontal: Spacing.block,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
  },
  sourceBadgeText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  detailsCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.surface,
    marginBottom: Spacing.block,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.row,
  },
  detailLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.medium,
  },
  detailValue: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.block,
  },
  detailDivider: {
    height: 1,
  },
  sourceDesc: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
    paddingVertical: Spacing.row,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    color: '#DC2626',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  notFoundText: {
    fontSize: FontSize.sectionTitle,
    marginBottom: Spacing.block,
  },
  backButtonFallback: {
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.row,
    borderRadius: BorderRadius.pill,
  },
  backButtonText: {
    fontSize: FontSize.body,
  },
});
