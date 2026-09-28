import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Trophy, Calendar, ChevronRight } from 'lucide-react-native';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import {
  ThemeColors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { YearlyGullakMetrics } from '../lib/chartUtils';

export interface YearlySavingsMilestoneCardProps {
  metrics: YearlyGullakMetrics;
  yearLabel: string;
  isDark: boolean;
  colors: ThemeColors;
  onOpenSavings?: () => void;
}

export const YearlySavingsMilestoneCard: React.FC<YearlySavingsMilestoneCardProps> = ({
  metrics,
  yearLabel,
  isDark,
  colors,
  onOpenSavings,
}) => {
  const {
    totalSavedInYear,
    bestSavingsMonth,
    bestStreakInYear,
  } = metrics;

  const iconBg = isDark ? 'rgba(184, 224, 200, 0.15)' : colors.mintGreenSoft;
  const iconColor = isDark ? colors.mintGreen : colors.mintGreenDark;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.borderSubtle : colors.border,
        },
      ]}
    >
      {/* ── Card Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconPod, { backgroundColor: iconBg }]}>
            <PiggyBankCoinIcon size={22} color={iconColor} />
          </View>
          <View style={styles.titleColumn}>
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Savings & Gullak
            </Text>
            <Text style={[styles.subTitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              Year of {yearLabel}
            </Text>
          </View>
        </View>

        {onOpenSavings && (
          <Pressable
            style={[styles.savingsBadge, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : '#E8F5EE' }]}
            onPress={onOpenSavings}
            accessibilityRole="button"
            accessibilityLabel="Open Gullak savings"
          >
            <Text style={[styles.savingsBadgeText, { color: iconColor, fontFamily: FontFamily.bold }]}>
              Gullak
            </Text>
            <ChevronRight size={12} color={iconColor} />
          </Pressable>
        )}
      </View>

      {/* ── Hero Metric: Total Saved in Year ── */}
      <View style={styles.heroMetricContainer}>
        <Text style={[styles.heroLabel, { fontFamily: FontFamily.bold, color: colors.textSecondary }]}>
          TOTAL SAVED IN {yearLabel}
        </Text>
        <View style={styles.amountRow}>
          <Text style={[styles.currencySymbol, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            ₹
          </Text>
          <Text style={[styles.amountValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            {totalSavedInYear.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <Text style={[styles.helperNote, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
          Includes daily rollover savings & manual deposits
        </Text>
      </View>

      {/* ── Highlights Grid: Best Month & Best Streak ── */}
      <View style={styles.statsGrid}>
        {/* Box 1: Best Month */}
        <View
          style={[
            styles.statBox,
            {
              backgroundColor: isDark ? colors.cardSubtle : '#F8FAFC',
              borderColor: isDark ? colors.borderSubtle : colors.borderSubtle,
            },
          ]}
        >
          <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.15)' : '#E8F5EE' }]}>
            <Calendar size={14} color={iconColor} />
          </View>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            Peak Month
          </Text>
          <Text
            style={[styles.statValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
            numberOfLines={1}
          >
            {bestSavingsMonth.month !== 'None' ? bestSavingsMonth.month : '—'}
          </Text>
          <Text style={[styles.statSubtext, { color: iconColor, fontFamily: FontFamily.bold }]}>
            {bestSavingsMonth.amount > 0 ? formatCurrency(bestSavingsMonth.amount) : 'No savings'}
          </Text>
        </View>

        {/* Box 2: Best Streak */}
        <View
          style={[
            styles.statBox,
            {
              backgroundColor: isDark ? colors.cardSubtle : '#F8FAFC',
              borderColor: isDark ? colors.borderSubtle : colors.borderSubtle,
            },
          ]}
        >
          <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(244, 184, 174, 0.15)' : '#FDEEEC' }]}>
            <Trophy size={14} color={isDark ? '#F4B8AE' : '#E8956A'} />
          </View>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            Best Streak
          </Text>
          <Text
            style={[styles.statValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
            numberOfLines={1}
          >
            {bestStreakInYear > 0 ? `${bestStreakInYear} Days` : '0 Days'}
          </Text>
          <Text style={[styles.statSubtext, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            Within budget
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.surface,
    borderWidth: 1,
    marginTop: Spacing.section,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconPod: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.group,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    fontSize: 18,
  },
  subTitle: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.nano,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 3,
  },
  savingsBadgeText: {
    fontSize: 11,
  },
  heroMetricContainer: {
    marginTop: Spacing.block,
    marginBottom: Spacing.block,
  },
  heroLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.nano,
  },
  currencySymbol: {
    fontSize: 24,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 34,
  },
  helperNote: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.nano,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.group,
  },
  statBox: {
    flex: 1,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.group,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.element,
  },
  statLabel: {
    fontSize: 11,
  },
  statValue: {
    fontSize: 15,
    marginTop: 2,
  },
  statSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
});
