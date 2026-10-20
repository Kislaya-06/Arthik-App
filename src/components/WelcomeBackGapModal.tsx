import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Sparkles, Plus, PiggyBank } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { format, parseISO } from 'date-fns';

import { BottomSheetModal } from './ui/BottomSheetModal';
import { AppButton } from './ui/AppButton';
import { formatAmountWithCommas } from '../lib/formatters';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

export interface WelcomeBackGapModalProps {
  visible: boolean;
  gapDates: string[];
  dailyBudgetAmount: number;
  onSaveToGullak: () => Promise<void> | void;
  onAddExpense: (targetDate: string) => void;
  onDismiss: () => void;
}

export const WelcomeBackGapModal: React.FC<WelcomeBackGapModalProps> = ({
  visible,
  gapDates,
  dailyBudgetAmount,
  onSaveToGullak,
  onAddExpense,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();
  const [isSaving, setIsSaving] = useState(false);

  if (!gapDates || gapDates.length === 0) {
    return null;
  }

  const dayCount = gapDates.length;
  const totalAmount = dayCount * dailyBudgetAmount;

  // Format date summary
  const dateSummary =
    dayCount === 1
      ? `yesterday (${format(parseISO(gapDates[0]), 'EEE, d MMM')})`
      : `${dayCount} days (${format(parseISO(gapDates[0]), 'd MMM')} – ${format(parseISO(gapDates[dayCount - 1]), 'd MMM')})`;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await onSaveToGullak();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = () => {
    const targetDate = gapDates[0];
    onAddExpense(targetDate);
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
          You had no recorded activity for {dateSummary}.
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
            TOTAL UNSPENT ALLOWANCE
          </Text>
          <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
            ₹{formatAmountWithCommas(String(totalAmount))}
          </Text>
          <Text style={[styles.amountExplainer, { color: colors.textMuted }]}>
            ₹{formatAmountWithCommas(String(dailyBudgetAmount))}/day allocated to your daily budget. Did you spend ₹0 on {dayCount === 1 ? 'this day' : 'these days'}?
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <AppButton
            label={`Save ₹${formatAmountWithCommas(String(totalAmount))} to Gullak`}
            icon={<Sparkles size={18} color="#FFFFFF" />}
            onPress={handleSave}
            variant="primary"
            size="cta"
            loading={isSaving}
            disabled={isSaving}
          />

          <AppButton
            label="I spent money"
            icon={<Plus size={18} color={colors.textPrimary} />}
            onPress={handleAdd}
            variant="outline"
            size="cta"
            disabled={isSaving}
          />

          <TouchableOpacity
            onPress={onDismiss}
            disabled={isSaving}
            style={styles.skipButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip for now</Text>
          </TouchableOpacity>
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
    letterSpacing: 0.8,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.element,
    marginTop: Spacing.element,
  },
  skipText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
});
