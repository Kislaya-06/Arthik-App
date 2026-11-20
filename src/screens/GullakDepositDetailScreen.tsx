import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import Trash2 from 'lucide-react-native/icons/trash';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { AmountText } from '../components/ui/AmountText';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AppButton } from '../components/ui/AppButton';
import { alertButtonPalette } from '../lib/alertButtonPalette';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'GullakDepositDetail'>;

export const GullakDepositDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { depositId } = route.params;
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const removeGullakDeposit = useDailyBudgetStore((s) => s.removeGullakDeposit);
  const { colors, isDark, isAmoled } = useTheme();
  // Icon follows the danger button text colour (dark text on the soft red in Dark / AMOLED).
  const dangerContentColor = alertButtonPalette('destructive', colors, isAmoled).text;
  const insets = useSafeAreaInsets();

  const deposit = gullakDeposits.find((d) => d.id === depositId);

  if (!deposit) {
    return (
      <View style={[styles.notFoundContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={[styles.notFoundText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          Deposit not found
        </Text>
        <PressableOpacity activeOpacity={PRESS_DIM_OPACITY} onPress={() => navigation.goBack()} style={[styles.backButtonFallback, { backgroundColor: colors.mintGreenSoft }]}>
          <Text style={[styles.backButtonText, { color: colors.isDark ? colors.mintGreenDark : colors.mintText, fontFamily: FontFamily.bold }]}>
            Go Back
          </Text>
        </PressableOpacity>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Withdraw from Gullak?',
      `Return ${formatCurrency(deposit.amount)} to your spending balance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
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
      <ScreenHeader title="Deposit Details" style={{ marginTop: insets.top + Spacing.micro }} />

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
          icon={<Trash2 size={18} color={dangerContentColor} />}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: FontSize.titleMedium,
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
