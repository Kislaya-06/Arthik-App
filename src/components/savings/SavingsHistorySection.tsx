import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { PressableOpacity } from '../ui/PressableOpacity';
import Calendar from 'lucide-react-native/icons/calendar';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { SegmentedControl } from '../ui/SegmentedControl';
import { EmptyState } from '../ui/EmptyState';
import { SavingsRecordRow } from '../SavingsRecordRow';
import { ControlHeight } from '../../config/theme';
import { groupSavingsHistory, groupTotalText, pageSavingsGroups } from '../../lib/savingsHistoryGroups';
import { formatCurrency } from '../../lib/formatters';
import { styles } from '../../screens/SavingsScreen.styles';

export interface SavingsHistorySectionProps {
  budgetCadence: string;
  filters: readonly string[];
  activeFilter: string;
  setActiveFilter: (filter: any) => void;
  unifiedList: any[];
  visibleUnifiedList: any[];
  hasMoreRecords: boolean;
  onSeeMore: () => void;
  onNavigateDeposit: (depositId: string) => void;
  handleDeleteDeposit: (id: string, amount: number) => void;
  colors: any;
  isDark: boolean;
}

export const SavingsHistorySection: React.FC<SavingsHistorySectionProps> = React.memo(({
  budgetCadence,
  filters,
  activeFilter,
  setActiveFilter,
  unifiedList,
  visibleUnifiedList,
  hasMoreRecords,
  onSeeMore,
  onNavigateDeposit,
  handleDeleteDeposit,
  colors,
  isDark,
}) => {
  // Week groups for a daily budget, month groups for weekly / monthly budgets. "See More" always
  // shows whole groups, so a group's total always matches the rows under it.
  const { visibleGroups, hiddenCount } = useMemo(() => {
    const groups = groupSavingsHistory(unifiedList, budgetCadence === 'daily' ? 'week' : 'month', new Date());
    const { shown, hiddenCount: hidden } = pageSavingsGroups(groups, visibleUnifiedList.length);
    return { visibleGroups: shown, hiddenCount: hidden };
  }, [unifiedList, visibleUnifiedList, budgetCadence]);
  const hasMore = hasMoreRecords && hiddenCount > 0;

  return (
    <>
      {/* ── Day-by-Day Savings History ── */}
      <View style={styles.historySectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {budgetCadence === 'weekly' ? 'Week-by-Week Savings History' : budgetCadence === 'monthly' ? 'Month-by-Month Savings History' : 'Day-by-Day Savings History'}
        </Text>
      </View>

      {/* Segmented Filter Toggle */}
      <View style={styles.filterToggleWrapper}>
        <SegmentedControl
          options={filters as unknown as string[]}
          selectedKey={activeFilter}
          onChange={(key) => setActiveFilter(key as any)}
          commitOnSettle
          height={ControlHeight.standard}
        />
      </View>

      {/* Past Records List */}
      {unifiedList.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <EmptyState
            size="section"
            icon={Calendar}
            title={activeFilter === 'Deposits' ? 'No Manual Deposits Yet' : 'No Past Savings History Yet'}
            subtitle={activeFilter === 'Deposits'
              ? 'Tap "Deposit to Gullak" above to add extra savings or cash directly into your jar.'
              : `At the end of each ${budgetCadence === 'weekly' ? 'week' : budgetCadence === 'monthly' ? 'month' : 'day'}, any unspent balance from your budget will automatically roll into your Savings Gullak and appear right here!`}
          />
        </View>
      ) : (
        <>
          {visibleGroups.map((group) => {
            const rows = group.items;
            const total = groupTotalText(group);
            const totalColor =
              total.tone === 'income' ? colors.mintText : total.tone === 'expense' ? colors.coralText : colors.textSecondary;
            return (
              <View key={group.key} style={styles.historyGroup}>
                <View
                  style={styles.historyGroupHeader}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={`${group.label.toLowerCase()}, ${
                    group.savedTotal > 0 ? `saved ${formatCurrency(group.savedTotal)}` : 'nothing saved'
                  }${group.overTotal > 0 ? `, over budget ${formatCurrency(group.overTotal)}` : ''}`}
                >
                  <Text style={[styles.historyGroupLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {group.label}
                  </Text>
                  <Text
                    style={[styles.historyGroupTotal, { color: totalColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {total.text}
                  </Text>
                </View>
                <View style={[styles.historyGroupCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  {rows.map((item, index) => (
                    <SavingsRecordRow
                      key={item.id}
                      rec={item.dailyRecord}
                      deposit={item.deposit}
                      period={item.period}
                      onPress={
                        item.deposit
                          ? () => onNavigateDeposit(item.deposit!.id)
                          : undefined
                      }
                      onDeleteDeposit={
                        item.deposit
                          ? () => handleDeleteDeposit(item.deposit!.id, item.deposit!.amount)
                          : undefined
                      }
                      colors={colors}
                      isDark={isDark}
                      isLast={index === rows.length - 1}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {hasMore && (
            <PressableOpacity
              style={[
                styles.seeMoreBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={onSeeMore}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Show ${hiddenCount} more records`}
            >
              <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
                {`See More (${hiddenCount} more)`}
              </Text>
              <ChevronDown size={16} color={colors.textSecondary} />
            </PressableOpacity>
          )}
        </>
      )}
    </>
  );
});
