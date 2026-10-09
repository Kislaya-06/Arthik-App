import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { GradientIconBadge } from './GradientIconBadge';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { ExpenseFundingBreakdown } from '../lib/transactionFunding';
import { Calendar, Wallet, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react-native';

export const ExpenseFundingCard: React.FC<{ funding: ExpenseFundingBreakdown }> = ({ funding }) => {
  const { colors, isDark } = useTheme();
  if (funding.isIncome || funding.isTransfer) return null;

  const rows = [
    funding.coveredByBudget > 0 && { key: 'b', title: 'Daily Allowance', sub: 'Within daily budget limit', amt: funding.coveredByBudget, col: '#ADEBB3', icon: (c: string) => <Calendar size={20} color={c} strokeWidth={2.2} /> },
    funding.coveredByIncome > 0 && { key: 'i', title: 'Paid from Income', sub: 'Covered overspending', amt: funding.coveredByIncome, col: '#B8E0C8', icon: (c: string) => <Wallet size={20} color={c} strokeWidth={2.2} /> },
    funding.coveredByGullak > 0 && { key: 'g', title: 'Paid from Gullak', sub: 'Deducted from savings', amt: funding.coveredByGullak, col: '#ADEBB3', alert: true, icon: (c: string) => <PiggyBankCoinIcon size={20} color={c} /> },
  ].filter(Boolean) as any[];

  const isG = funding.coveredByGullak > 0;
  const isI = funding.coveredByIncome > 0;
  const Icon = isG ? AlertCircle : isI ? Sparkles : CheckCircle2;
  const iconColor = isG ? colors.coral : colors.mintGreenDark;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle, borderWidth: isDark ? 1 : 0 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>
          {rows.length > 1 ? 'SPLIT FUNDING BREAKDOWN' : 'FUNDING SOURCE'}
        </Text>
        {funding.isOverBudget && (
          <View style={[styles.badge, { backgroundColor: isG ? colors.peachSoft : colors.mintGreenSoft }]}>
            <Text style={[styles.badgeText, { color: iconColor }]}>{isG ? 'Gullak Used' : 'Over Limit'}</Text>
          </View>
        )}
      </View>

      {rows.map((r, i) => (
        <View key={r.key} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
          <GradientIconBadge size={40} color={r.col} isDark={isDark}>{({ iconColor: c }) => r.icon(c)}</GradientIconBadge>
          <View style={styles.content}>
            <Text style={[styles.rowTitle, { color: r.alert ? colors.coral : colors.textPrimary }]}>{r.title}</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{r.sub}</Text>
          </View>
          <Text style={[styles.amt, { color: r.alert ? colors.coral : colors.textPrimary }]}>{formatCurrency(r.amt)}</Text>
        </View>
      ))}

      <View style={[styles.callout, { backgroundColor: colors.cardSubtle }]}>
        <Icon size={16} color={iconColor} style={styles.calloutIcon} />
        <Text style={[styles.calloutText, { color: colors.textPrimary }]}>{funding.explanation}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.card, padding: Spacing.surface, marginTop: Spacing.block },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.element },
  title: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: 0.8 },
  badge: { paddingHorizontal: Spacing.element, paddingVertical: 3, borderRadius: BorderRadius.pill },
  badgeText: { fontSize: FontSize.micro, fontFamily: FontFamily.bold },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.group },
  content: { flex: 1, marginLeft: Spacing.group },
  rowTitle: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  rowSub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: 2 },
  amt: { fontSize: FontSize.body, fontFamily: FontFamily.bold, marginLeft: Spacing.element },
  callout: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.input, padding: Spacing.group, marginTop: Spacing.group },
  calloutIcon: { marginRight: Spacing.element, flexShrink: 0 },
  calloutText: { flex: 1, fontSize: FontSize.caption, fontFamily: FontFamily.medium, lineHeight: 18 },
});
