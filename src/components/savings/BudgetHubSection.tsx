import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ChevronRight, Clock, X, Sparkles } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { PiggyBankCoinIcon } from '../PiggyBankCoinIcon';
import { GradientIconBadge } from '../GradientIconBadge';
import { AnimatedToggle } from '../AnimatedToggle';
import { AmountText } from '../ui/AmountText';
import { Spacing, FontFamily } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { useTheme } from '../../store/themeStore';
import { useSavingsDashboard } from '../../hooks/useSavingsDashboard';
import { styles } from '../../screens/SavingsScreen.styles';

const OVER_BUDGET_CORAL = '#FF7A6E';
const OVER_BUDGET_CORAL_DOT = '#FF6B5E';

export interface BudgetHubSectionProps {
  dashboard: ReturnType<typeof useSavingsDashboard>;
  allowanceCardSize: { width: number; height: number };
  setAllowanceCardSize: (size: { width: number; height: number }) => void;
  cardTitle: string;
  cardDateBadge: string;
  cardBudget: number;
  cardSpent: number;
  cardTarget: number;
  cardIsOver: boolean;
  cardProgressRatio: number;
  animatedProgressWidth: any;
  cadencePeriodSummary: any;
  handleCancelScheduled: () => void;
  pendingPlanChange: any;
  cancelPendingPlanChange: () => void;
  isOverBudget: boolean;
  overspendHint: string;
  budgetCadence: string;
  weeklyBudgetAmount: number;
  monthlyBudgetAmount: number;
}

export const BudgetHubSection: React.FC<BudgetHubSectionProps> = ({
  dashboard,
  allowanceCardSize,
  setAllowanceCardSize,
  cardTitle,
  cardDateBadge,
  cardBudget,
  cardSpent,
  cardTarget,
  cardIsOver,
  cardProgressRatio,
  animatedProgressWidth,
  cadencePeriodSummary,
  handleCancelScheduled,
  pendingPlanChange,
  cancelPendingPlanChange,
  isOverBudget,
  overspendHint,
  budgetCadence,
  weeklyBudgetAmount,
  monthlyBudgetAmount,
}) => {
  const { isDark } = useTheme();
  const {
    isAutoRenew,
    handleToggleAutoRenew,
    scheduledNextDailyBudget,
    openBudgetModal,
    dailyBudgetAmount,
  } = dashboard;

  return (
    <View
      style={[
        styles.unifiedBudgetCard,
        {
          backgroundColor: '#581C87',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          overflow: 'hidden',
          elevation: isDark ? 0 : 2,
        },
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== allowanceCardSize.width || height !== allowanceCardSize.height)) {
          setAllowanceCardSize({ width, height });
        }
      }}
    >
      {/* Violet Gradient Backdrop matching Gullak Hero Card */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg
          key={`allowance_${allowanceCardSize.width}_${allowanceCardSize.height}`}
          width={allowanceCardSize.width || '100%'}
          height={allowanceCardSize.height ? allowanceCardSize.height + 4 : '100%'}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgLinearGradient id="allowanceCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#8B5CF6" />
              <Stop offset="100%" stopColor="#581C87" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={allowanceCardSize.width || '100%'}
            height={allowanceCardSize.height ? allowanceCardSize.height + 4 : '100%'}
            fill="url(#allowanceCardGrad)"
          />
        </Svg>
      </View>

      {/* Row 1: Title + Date Pill inline left, Status indicator right */}
      <View style={styles.ucTopRow}>
        <View style={styles.ucTitleRow}>
          <Text style={[styles.ucTitle, { color: '#FFFFFF' }]}>
            {cardTitle}
          </Text>
          <View
            style={[
              styles.ucDateBadge,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
            ]}
          >
            <Text style={[styles.ucDateBadgeText, { color: '#FFFFFF' }]}>
              {cardDateBadge}
            </Text>
          </View>
        </View>

        {/* Unboxed High-Visibility Status Indicator */}
        {isAutoRenew && cardBudget > 0 ? (
          <View style={styles.ucStatusRow}>
            <View
              style={[
                styles.ucStatusDot,
                {
                  backgroundColor: cardIsOver
                    ? OVER_BUDGET_CORAL_DOT
                    : cardProgressRatio >= 0.8
                    ? '#FBBF24'
                    : '#FFFFFF',
                },
              ]}
            />
            <Text
              style={[
                styles.ucStatusText,
                {
                  color: cardIsOver
                    ? OVER_BUDGET_CORAL
                    : cardProgressRatio >= 0.8
                    ? '#FDE68A'
                    : '#FFFFFF',
                },
              ]}
            >
              {cardIsOver ? 'Over budget' : cardProgressRatio >= 0.8 ? 'Near limit' : 'On track'}
            </Text>
          </View>
        ) : (
          <View style={styles.ucStatusRow}>
            <View
              style={[
                styles.ucStatusDot,
                { backgroundColor: 'rgba(255, 255, 255, 0.5)' },
              ]}
            />
            <Text style={[styles.ucStatusText, { color: 'rgba(255, 255, 255, 0.85)' }]}>
              Paused
            </Text>
          </View>
        )}
      </View>

      {/* Body: Active or Paused */}
      {isAutoRenew ? (
        <View style={styles.ucBody}>
          {/* Row 2: Hero Amount & Budget Change */}
          <View style={styles.ucHeroRow}>
            <View style={styles.ucHeroLeft}>
              <Text
                style={[
                  styles.ucHeroLabel,
                  { color: cardIsOver ? OVER_BUDGET_CORAL : 'rgba(255, 255, 255, 0.75)' },
                ]}
              >
                {cardIsOver ? 'EXCEEDED BY' : 'LEFT TO SPEND'}
              </Text>
              <View style={styles.ucAmountRow}>
                <AmountText
                  role="primary"
                  value={cardTarget}
                  color={cardIsOver ? OVER_BUDGET_CORAL : '#FFFFFF'}
                  rolling
                  rollOnFocus
                />
              </View>
            </View>

            {/* Right Column: Highlighted Change Action Button */}
            <View style={styles.ucHeroRight}>
              <TouchableOpacity
                onPress={() => openBudgetModal('recurring')}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.ucChangeBtn}
              >
                <Text style={styles.ucChangeBtnText}>
                  Change
                </Text>
                <ChevronRight size={13} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 3: Progress Bar */}
          <View
            style={[
              styles.ucProgressTrack,
              { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
            ]}
            accessibilityLabel={`Spent ${formatCurrency(cardSpent)} of ${formatCurrency(cardBudget)} budget`}
            accessibilityRole="progressbar"
          >
            <Animated.View
              style={[
                styles.ucProgressFill,
                {
                  width: animatedProgressWidth,
                  backgroundColor: cardIsOver ? OVER_BUDGET_CORAL : '#FFFFFF',
                },
              ]}
            />
          </View>

          {/* Under-bar spending split */}
          <View style={styles.ucProgressLabels}>
            <Text style={[styles.ucProgressLabelText, { color: 'rgba(255, 255, 255, 0.75)' }]}>
              Spent <Text style={[styles.ucProgressLabelValue, { color: '#FFFFFF' }]}>{formatCurrency(cardSpent)}</Text>
            </Text>
            <Text style={[styles.ucProgressLabelText, { color: 'rgba(255, 255, 255, 0.75)' }]}>
              <Text style={[styles.ucProgressLabelValue, { color: '#FFFFFF' }]}>{formatCurrency(cardBudget)}</Text>{' '}
              {cadencePeriodSummary?.carriedOverAmount &&
              cadencePeriodSummary.carriedOverAmount > 0 &&
              cadencePeriodSummary.carryMode === 'additive'
                ? `pool (${formatCurrency(cadencePeriodSummary.baseBudget || cardBudget - cadencePeriodSummary.carriedOverAmount)} + ${formatCurrency(cadencePeriodSummary.carriedOverAmount)} carried)`
                : 'budget'}
            </Text>
          </View>

          {/* Scheduled Tomorrow Budget Banner (if active) */}
          {scheduledNextDailyBudget !== null && scheduledNextDailyBudget > 0 && (
            <View style={[styles.scheduledBanner, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }]}>
              <Clock size={15} color="#FFFFFF" style={{ marginRight: Spacing.element }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.scheduledBannerTitle, { color: '#FFFFFF', fontFamily: FontFamily.bold }]}>
                  Tomorrow's Budget: {formatCurrency(scheduledNextDailyBudget)}
                </Text>
                <Text style={[styles.scheduledBannerSubtitle, { color: 'rgba(255, 255, 255, 0.8)', fontFamily: FontFamily.medium }]}>
                  Takes effect at 12:00 AM
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelScheduled} hitSlop={8}>
                <X size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          )}

          {/* Scheduled Next Cadence Switch Banner (if active) */}
          {pendingPlanChange && (
            <View
              style={[
                styles.scheduledBanner,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                },
              ]}
            >
              <Clock size={15} color="#FFFFFF" style={{ marginRight: Spacing.element }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.scheduledBannerTitle,
                    { color: '#FFFFFF', fontFamily: FontFamily.bold },
                  ]}
                >
                  Tomorrow: Switch to {pendingPlanChange.cadence.toUpperCase()} ({formatCurrency(pendingPlanChange.amount)})
                </Text>
                <Text
                  style={[
                    styles.scheduledBannerSubtitle,
                    { color: 'rgba(255, 255, 255, 0.85)', fontFamily: FontFamily.medium },
                  ]}
                >
                  {pendingPlanChange.carriedOverAmount && pendingPlanChange.carriedOverAmount > 0
                    ? `${formatCurrency(pendingPlanChange.carriedOverAmount)} carried forward (${pendingPlanChange.carryMode === 'additive' ? 'Additive' : 'Allocation'})`
                    : 'Takes effect tomorrow at 12:00 AM'}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelPendingPlanChange} hitSlop={8}>
                <X size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          )}

          {/* Row 4: Dedicated Auto-save Feature Row (Unboxed) */}
          <View style={styles.ucAutoSaveCapsule}>
            <View style={styles.ucAutoSaveLeft}>
              <GradientIconBadge size={40} color="#FFFFFF" isDark={isDark}>
                {({ iconColor }) => <PiggyBankCoinIcon size={20} color={iconColor} />}
              </GradientIconBadge>
              <View style={styles.ucAutoSaveTextWrap}>
                <Text style={[styles.ucAutoSaveLabel, { color: '#FFFFFF' }]}>
                  Auto-save unspent to Gullak
                </Text>
                <Text
                  style={[
                    styles.ucFooterHint,
                    {
                      color: isOverBudget ? OVER_BUDGET_CORAL : 'rgba(255, 255, 255, 0.85)',
                      fontFamily: isOverBudget ? FontFamily.semibold : FontFamily.medium,
                    },
                  ]}
                >
                  {overspendHint}
                </Text>
              </View>
            </View>
            <AnimatedToggle
              value={isAutoRenew}
              onValueChange={handleToggleAutoRenew}
              width={52}
              height={26}
              onColor="#FFFFFF"
              offColor="#FFFFFF"
              trackColor="rgba(255, 255, 255, 0.2)"
            />
          </View>
        </View>
      ) : (
        /* Paused State */
        <View style={styles.ucBody}>
          <View style={styles.pausedStateBox}>
            <View style={styles.pausedStateTop}>
              <View style={[styles.pausedIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.18)' }]}>
                <Sparkles size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pausedTitle, { color: '#FFFFFF' }]}>
                  {budgetCadence === 'weekly'
                    ? 'Weekly Budget Paused'
                    : budgetCadence === 'monthly'
                    ? 'Monthly Budget Paused'
                    : 'Daily Allowance Paused'}
                </Text>
                <Text style={[styles.pausedDesc, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                  Auto-rollover to Gullak is paused. All your past savings stay 100% safe.
                </Text>
              </View>
            </View>

            <View style={[styles.pausedDivider, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />

            <View style={styles.pausedBottomRow}>
              <View>
                <Text style={[styles.pausedSubLabel, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                  Configured {budgetCadence === 'weekly' ? 'Weekly Budget' : budgetCadence === 'monthly' ? 'Monthly Budget' : 'Daily Allowance'}
                </Text>
                {(budgetCadence === 'weekly' ? weeklyBudgetAmount : budgetCadence === 'monthly' ? monthlyBudgetAmount : dailyBudgetAmount) > 0 ? (
                  <AmountText
                    role="primary"
                    value={budgetCadence === 'weekly' ? weeklyBudgetAmount : budgetCadence === 'monthly' ? monthlyBudgetAmount : dailyBudgetAmount}
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={[styles.pausedAmountText, { color: '#FFFFFF' }]}>
                    Not Set
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.ucChangeBtn,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.10)',
                    borderColor: 'rgba(255, 255, 255, 0.16)',
                  },
                ]}
                disabled={true}
                activeOpacity={1}
                accessibilityState={{ disabled: true }}
              >
                <Text style={[styles.ucChangeBtnText, { color: 'rgba(255, 255, 255, 0.4)' }]}>
                  {(budgetCadence === 'weekly' ? weeklyBudgetAmount : budgetCadence === 'monthly' ? monthlyBudgetAmount : dailyBudgetAmount) > 0 ? 'Change' : 'Set Limit'}
                </Text>
                <ChevronRight size={13} color="rgba(255, 255, 255, 0.4)" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Auto-save toggle capsule to re-enable (Unboxed, clean) */}
          <View
            style={[
              styles.ucAutoSaveCapsule,
              {
                marginTop: Spacing.group,
              },
            ]}
          >
            <View style={styles.ucAutoSaveLeft}>
              <GradientIconBadge size={40} color="#FFFFFF" isDark={isDark}>
                {({ iconColor }) => <PiggyBankCoinIcon size={20} color={iconColor} />}
              </GradientIconBadge>
              <View style={styles.ucAutoSaveTextWrap}>
                <Text style={[styles.ucAutoSaveLabel, { color: '#FFFFFF' }]}>
                  Auto-save unspent to Gullak
                </Text>
                <Text style={[styles.ucFooterHint, { color: 'rgba(255, 255, 255, 0.85)' }]}>
                  {budgetCadence === 'weekly'
                    ? 'Turn on to resume weekly rollover into Gullak'
                    : budgetCadence === 'monthly'
                    ? 'Turn on to resume monthly rollover into Gullak'
                    : 'Turn on to resume daily rollover into Gullak'}
                </Text>
              </View>
            </View>
            <AnimatedToggle
              value={isAutoRenew}
              onValueChange={handleToggleAutoRenew}
              width={52}
              height={26}
              onColor="#FFFFFF"
              offColor="#FFFFFF"
              trackColor="rgba(255, 255, 255, 0.2)"
            />
          </View>
        </View>
      )}
    </View>
  );
};
