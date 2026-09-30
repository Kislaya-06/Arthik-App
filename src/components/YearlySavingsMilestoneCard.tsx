import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Trophy, Calendar, ChevronRight } from 'lucide-react-native';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
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
          <GradientIconBadge size={44} color="#ADEBB3" isDark={isDark}>
            {({ iconColor: badgeIconColor }) => <PiggyBankCoinIcon size={22} color={badgeIconColor} />}
          </GradientIconBadge>
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

      {/* ── Divider Line (like Recent Transactions) ── */}
      <View
        style={[
          styles.dividerLine,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          },
        ]}
      />

      {/* ── Highlights: Peak Month & Best Streak (Seamless, Non-boxy) ── */}
      <View style={styles.highlightsRow}>
        {/* Highlight 1: Peak Month */}
        <View style={styles.highlightCol}>
          <View style={styles.highlightLabelRow}>
            <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.16)' : '#E8F5EE' }]}>
              <Calendar size={15} color={iconColor} strokeWidth={2.2} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Peak Month
            </Text>
          </View>
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

        {/* Subtle Vertical Divider */}
        <View
          style={[
            styles.verticalDivider,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        />

        {/* Highlight 2: Best Streak */}
        <View style={styles.highlightCol}>
          <View style={styles.highlightLabelRow}>
            <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(244, 184, 174, 0.16)' : '#FDEEEC' }]}>
              <Trophy size={15} color={isDark ? '#F4B8AE' : '#E8956A'} strokeWidth={2.2} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Best Streak
            </Text>
          </View>
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
  titleColumn: {
    flex: 1,
    marginLeft: Spacing.group,
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
  dividerLine: {
    height: 1,
    width: '100%',
    marginVertical: Spacing.surface,
  },
  highlightsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  highlightCol: {
    flex: 1,
  },
  highlightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginBottom: 6,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 20,
    letterSpacing: -0.2,
  },
  statSubtext: {
    fontSize: 13,
    marginTop: 3,
  },
  verticalDivider: {
    width: 1,
    height: 60,
    marginHorizontal: Spacing.group,
    alignSelf: 'center',
  },
});
