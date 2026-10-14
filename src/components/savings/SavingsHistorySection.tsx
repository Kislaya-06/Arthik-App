import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SavingsRecordRow } from '../SavingsRecordRow';
import { ControlHeight } from '../../config/theme';
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

export const SavingsHistorySection: React.FC<SavingsHistorySectionProps> = ({
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
          height={ControlHeight.standard}
        />
      </View>

      {/* Past Records List */}
      {unifiedList.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Calendar size={36} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {activeFilter === 'Deposits' ? 'No Manual Deposits Yet' : 'No Past Savings History Yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {activeFilter === 'Deposits'
              ? 'Tap "Deposit to Gullak" above to add extra savings or cash directly into your jar.'
              : `At the end of each ${budgetCadence === 'weekly' ? 'week' : budgetCadence === 'monthly' ? 'month' : 'day'}, any unspent balance from your budget will automatically roll into your Savings Gullak and appear right here!`}
          </Text>
        </View>
      ) : (
        <>
          {visibleUnifiedList.map((item) => (
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
            />
          ))}

          {hasMoreRecords && (
            <TouchableOpacity
              style={[
                styles.seeMoreBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={onSeeMore}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
                See More
              </Text>
              <ChevronDown size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </>
      )}
    </>
  );
};
