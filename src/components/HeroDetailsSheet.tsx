import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal } from './ui/BottomSheetModal';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import type { HeroDetails } from '../lib/heroDetails';

export interface HeroDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** e.g. "Today" / "This week". */
  title: string;
  /** e.g. "Sunday, 18 Oct" / "12–18 Oct · till today". */
  subtitle: string;
  details: HeroDetails;
}

/**
 * Tap-to-open details of the Home card: the whole story of the period behind the one chip on the card
 * (budget, money in, Gullak). Same numbers as the card, calibrated with clear visual hierarchy.
 */
export const HeroDetailsSheet: React.FC<HeroDetailsSheetProps> = ({ visible, onClose, title, subtitle, details }) => {
  const { colors, isDark } = useTheme();

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={title} colors={colors} isDark={isDark} swipeToDismiss>
      <View style={styles.wrap}>
        {/* ── Hero Spent Card (Primary Visual Anchor) ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}>
          <View style={styles.heroLeft}>
            <Text style={[styles.heroLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
              TOTAL SPENT
            </Text>
            <Text style={[styles.heroDate, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
              {subtitle}
            </Text>
          </View>
          <Text style={[styles.heroAmount, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            {formatCurrency(details.totalSpent)}
          </Text>
        </View>

        {/* ── Breakdown Sections ── */}
        {details.sections.map((section) => (
          <View key={section.id} style={[styles.card, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
              {section.title.toUpperCase()}
            </Text>
            {section.rows.map((row) => {
              // Tone calibration: zero amounts remain neutral to preserve visual hierarchy
              const color =
                row.amount === 0
                  ? colors.textMuted
                  : row.tone === 'bad'
                  ? colors.coral
                  : row.tone === 'good'
                  ? (isDark ? colors.mintGreen : colors.mintGreenDark)
                  : colors.textPrimary;

              return (
                <View key={row.id} style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.rowAmount, { color, fontFamily: FontFamily.bold }]}>
                    {formatCurrency(row.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.group },
  heroCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.input,
    paddingVertical: Spacing.block,
    paddingHorizontal: Spacing.surface,
    borderWidth: 1,
  },
  heroLeft: {
    gap: Spacing.nano,
  },
  heroLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
  },
  heroDate: {
    fontSize: FontSize.caption,
  },
  heroAmount: {
    fontSize: FontSize.titleLarge,
  },
  card: {
    borderRadius: BorderRadius.input,
    padding: Spacing.block,
    gap: Spacing.element,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  rowLabel: {
    fontSize: FontSize.bodySmall,
    flexShrink: 1,
  },
  rowAmount: {
    fontSize: FontSize.bodySmall,
  },
});
