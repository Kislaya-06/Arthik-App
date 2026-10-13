import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StreakFlame } from '../StreakFlame';
import { styles } from '../../screens/SavingsScreen.styles';

export interface SavingsHeaderProps {
  budgetCadence: string;
  effectiveStreak: number;
  onOpenStreakCalendar: () => void;
  colors: any;
  isDark: boolean;
}

export const SavingsHeader: React.FC<SavingsHeaderProps> = ({
  budgetCadence,
  effectiveStreak,
  onOpenStreakCalendar,
  colors,
  isDark,
}) => {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
          Savings & Gullak
        </Text>
        <Text
          style={[styles.screenTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {budgetCadence === 'weekly' ? 'Weekly Savings' : budgetCadence === 'monthly' ? 'Monthly Savings' : 'Daily Savings'}
        </Text>
      </View>

      {/* Streak Badge (Bonus Feature #2 - Tappable for Calendar) */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onOpenStreakCalendar}
        style={[
          styles.streakBadge,
          {
            backgroundColor: isDark ? 'rgba(244, 184, 174, 0.18)' : '#FDEEEC',
            borderColor: colors.peachCoral,
          },
        ]}
      >
        <StreakFlame streak={effectiveStreak} size={18} />
        <Text style={[styles.streakBadgeText, { color: '#E05638' }]}>
          {effectiveStreak} {budgetCadence === 'weekly' ? (effectiveStreak === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (effectiveStreak === 1 ? 'Month' : 'Months') : (effectiveStreak === 1 ? 'Day' : 'Days')} Streak
        </Text>
      </TouchableOpacity>
    </View>
  );
};
