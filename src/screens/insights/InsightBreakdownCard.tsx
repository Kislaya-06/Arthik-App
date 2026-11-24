/**
 * A card with one stacked bar and its legend: "When you spend" (time of day) and "Where Gullak money came from".
 * Same card surface as BehavioralInsightRow so the Insights list reads as one family.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { BorderRadius, FontFamily, FontSize, LetterSpacing, Spacing } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';

export interface BreakdownSegment {
  label: string;
  amount: number;
  color: string;
}

interface Props {
  title: string;
  headline: string;
  segments: BreakdownSegment[];
  /** An extra line under the legend, kept out of the bar (e.g. Gullak used to cover overspending). */
  extraLine?: { label: string; amount: number } | null;
  footnote?: string;
}

export const InsightBreakdownCard: React.FC<Props> = ({ title, headline, segments, extraLine, footnote }) => {
  const { colors, isDark } = useTheme();
  const total = segments.reduce((s, x) => s + x.amount, 0);
  const shown = segments.filter((s) => s.amount > 0);
  const summary = shown.map((s) => `${s.label} ${formatCurrency(s.amount)}`).join(', ');

  return (
    <View
      accessible
      accessibilityLabel={`${title}: ${headline}. ${summary}.${extraLine ? ` ${extraLine.label} ${formatCurrency(extraLine.amount)}.` : ''}${footnote ? ` ${footnote}` : ''}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      <Text style={[styles.headline, { color: colors.textPrimary }]} maxFontSizeMultiplier={1.3}>
        {headline}
      </Text>

      <View style={[styles.bar, { backgroundColor: colors.chartTrack }]}>
        {total > 0 &&
          shown.map((s) => <View key={s.label} style={{ flex: s.amount / total, backgroundColor: s.color }} />)}
      </View>

      {shown.map((s) => (
        <View key={s.label} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: s.color }]} />
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {s.label}
          </Text>
          <Text style={[styles.legendAmount, { color: colors.textPrimary }]} maxFontSizeMultiplier={1.3}>
            {formatCurrency(s.amount)}
            {total > 0 && <Text style={{ color: colors.textMuted }}>{`  ${s.amount / total < 0.005 ? '<1' : Math.round((s.amount / total) * 100)}%`}</Text>}
          </Text>
        </View>
      ))}

      {extraLine && (
        <View style={[styles.legendRow, styles.extraRow, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.legendLabel, { color: colors.textSecondary, marginLeft: 0 }]} maxFontSizeMultiplier={1.3}>
            {extraLine.label}
          </Text>
          <Text style={[styles.legendAmount, { color: colors.coralText }]} maxFontSizeMultiplier={1.3}>
            −{formatCurrency(extraLine.amount)}
          </Text>
        </View>
      )}

      {!!footnote && (
        <Text style={[styles.footnote, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
          {footnote}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.block,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.group,
  },
  title: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: LetterSpacing.label,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.micro,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: Spacing.group,
    marginBottom: Spacing.element,
    gap: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.micro,
  },
  extraRow: {
    marginTop: Spacing.micro,
    paddingTop: Spacing.element,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    marginLeft: Spacing.element,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
  legendAmount: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  footnote: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.element,
  },
});
