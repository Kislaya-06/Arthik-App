import React from 'react';
import { View, Text } from 'react-native';
import { PressableOpacity } from '../ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';
import { StreakFlame } from '../StreakFlame';
import { styles } from '../../screens/SavingsScreen.styles';

export interface SavingsHeaderProps {
  budgetCadence: string;
  effectiveStreak: number;
  onOpenStreakCalendar: () => void;
  colors: any;
  isDark: boolean;
}

export const SavingsHeader: React.FC<SavingsHeaderProps> = React.memo(({
  budgetCadence,
  effectiveStreak,
  onOpenStreakCalendar,
  colors,
}) => {
  const unit = budgetCadence === 'weekly' ? 'Week' : budgetCadence === 'monthly' ? 'Month' : 'Day';
  const noStreak = effectiveStreak <= 0;
  const streakLabel = noStreak ? 'Start a streak today' : `${effectiveStreak} ${unit}${effectiveStreak === 1 ? '' : 's'} Streak`;
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
          Savings & Gullak
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.screenTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {budgetCadence === 'weekly' ? 'Weekly Savings' : budgetCadence === 'monthly' ? 'Monthly Savings' : 'Daily Savings'}
        </Text>
      </View>

      {/* Streak chip (opens the Streak Calendar) */}
      <PressableOpacity
        activeOpacity={PRESS_DIM_OPACITY}
        onPress={onOpenStreakCalendar}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`${streakLabel}. Open streak calendar`}
        style={[styles.streakBadge, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}
      >
        {!noStreak && <StreakFlame streak={effectiveStreak} size={22} />}
        <Text style={[styles.streakBadgeText, { color: noStreak ? colors.textSecondary : colors.coralText }]} numberOfLines={1}>
          {streakLabel}
        </Text>
      </PressableOpacity>
    </View>
  );
});
