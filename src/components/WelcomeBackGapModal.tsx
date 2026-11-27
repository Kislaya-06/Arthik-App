import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Plus from 'lucide-react-native/icons/plus';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';

import { BottomSheetModal } from './ui/BottomSheetModal';
import { AppButton } from './ui/AppButton';
import { formatAmountWithCommas } from '../lib/formatters';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, LetterSpacing } from '../config/theme';

export interface WelcomeBackGapModalProps {
  visible: boolean;
  from: string;
  to: string;
  /** Budget money of the closed days. */
  amount: number;
  /** true = 7+ days without any expense: the user chooses (rule 29). false = already saved (rule 28). */
  needsChoice: boolean;
  onSave: () => void;
  onSkip: () => void;
  onAddExpense: (targetDate: string) => void;
  onDismiss: () => void;
}

export const WelcomeBackGapModal: React.FC<WelcomeBackGapModalProps> = ({
  visible,
  from,
  to,
  amount,
  needsChoice,
  onSave,
  onSkip,
  onAddExpense,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();

  if (!from || !to) {
    return null;
  }

  const dateSummary =
    from === to
      ? format(parseISO(from), 'EEE, d MMM')
      : `${format(parseISO(from), 'd MMM')} – ${format(parseISO(to), 'd MMM')}`;
  const money = `₹${formatAmountWithCommas(String(amount))}`;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSave();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onDismiss}
      colors={colors}
      isDark={isDark}
      containerStyle={styles.sheetContainer}
    >
      <View style={styles.content}>
        {/* Top Hero Icon Badge */}
        <View style={styles.badgeWrapper}>
          <View style={[styles.badge, { backgroundColor: colors.mintGreenSoft }]}>
            <PiggyBank size={28} color={colors.mintGreenDark} />
          </View>
        </View>

        {/* Title & Context */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome Back! 👋</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          You had no recorded activity ({dateSummary}).
        </Text>

        {/* Unspent Allowance Card */}
        <View
          style={[
            styles.amountCard,
            {
              backgroundColor: colors.cardSubtle,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            {needsChoice ? 'UNSPENT BUDGET' : 'SAVED TO GULLAK'}
          </Text>
          <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
            {money}
          </Text>
          <Text style={[styles.amountExplainer, { color: colors.textMuted }]}>
            {needsChoice ? 'Choose if this budget should count.' : 'Spent something on these days? Add it and the saved money updates.'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <AppButton
            label={needsChoice ? `Save ${money} to Gullak` : 'OK'}
            icon={needsChoice ? <Sparkles size={18} color={colors.white} /> : undefined}
            onPress={needsChoice ? handleSave : onDismiss}
            variant="primary"
            size="cta"
          />

          <AppButton
            label="I spent money"
            icon={<Plus size={18} color={colors.textPrimary} />}
            onPress={() => onAddExpense(from)}
            variant="outline"
            size="cta"
          />

          {needsChoice && (
            <AppButton
              label="Don't count these days"
              onPress={onSkip}
              variant="ghost"
              size="cta"
              style={styles.skipButton}
            />
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    paddingHorizontal: Spacing.gutter,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  content: {
    alignItems: 'center',
    paddingTop: Spacing.element,
  },
  badgeWrapper: {
    marginBottom: Spacing.element,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.titleMedium,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.micro,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.medium,
    lineHeight: LineHeight.body,
    textAlign: 'center',
    marginBottom: Spacing.block,
  },
  amountCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.block,
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginBottom: Spacing.block,
  },
  amountLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: LetterSpacing.label,
    marginBottom: Spacing.micro,
  },
  amountValue: {
    fontSize: FontSize.titleLarge,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
    marginBottom: Spacing.micro,
  },
  amountExplainer: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: LineHeight.caption,
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.element,
  },
  skipButton: {
    marginTop: Spacing.element,
  },
});
