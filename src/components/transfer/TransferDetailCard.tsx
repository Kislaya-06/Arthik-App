import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../store/themeStore';
import type { Expense } from '../../store/expenseStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';

/** Detail-screen section explaining what a self-transfer is (TXN-003). Renders nothing for normal transactions. */
export const TransferDetailCard: React.FC<{ expense: Expense }> = ({ expense }) => {
  const { colors } = useTheme();
  if (expense.transaction_class !== 'self_transfer') return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Transfer between your accounts</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Not counted as income or expense, and does not change your budget or Gullak.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.card, padding: Spacing.surface, marginTop: Spacing.block, borderWidth: 1, gap: Spacing.micro },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
});
