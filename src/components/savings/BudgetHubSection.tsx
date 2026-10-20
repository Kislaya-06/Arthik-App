import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ChevronRight, Clock, X } from 'lucide-react-native';
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
  budgetCadence?: string;
  weeklyBudgetAmount?: number;
  monthlyBudgetAmount?: number;
  toggleValue?: boolean;
  onToggleBudgetMode?: (val: boolean) => void;
  isScheduledSwitch?: boolean;
}

export const BudgetHubSection: React.FC<BudgetHubSectionProps> = React.memo(({
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
  toggleValue: propToggleValue,
  onToggleBudgetMode,
  isScheduledSwitch = false,
}) => {
  const { isDark } = useTheme();
  const {
    isAutoRenew,
    handleToggleAutoRenew,
    scheduledNextDailyBudget,
    openBudgetModal,
  } = dashboard;

  const activeToggleValue = propToggleValue !== undefined ? propToggleValue : isAutoRenew;
  const handleToggle = onToggleBudgetMode || handleToggleAutoRenew;

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
        {cardBudget > 0 && (
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
        )}
      </View>

      {/* Body: Always Active */}
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

          {/* Scheduled Next Cadence or Mode Switch Banner (if active) */}
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
                  {pendingPlanChange.isEnabled
                    ? `Tomorrow: Switch to ${pendingPlanChange.cadence.toUpperCase()} (${formatCurrency(pendingPlanChange.amount)})`
                    : 'Tomorrow: Switching to Pure Mode'}
                </Text>
                <Text
                  style={[
                    styles.scheduledBannerSubtitle,
                    { color: 'rgba(255, 255, 255, 0.85)', fontFamily: FontFamily.medium },
                  ]}
                >
                  {pendingPlanChange.isEnabled
                    ? pendingPlanChange.carriedOverAmount && pendingPlanChange.carriedOverAmount > 0
                      ? `${formatCurrency(pendingPlanChange.carriedOverAmount)} carried forward (${pendingPlanChange.carryMode === 'additive' ? 'Additive' : 'Allocation'})`
                      : 'Takes effect tomorrow at 12:00 AM'
                    : 'Takes effect tomorrow at 12:00 AM · Tap ✕ to cancel'}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelPendingPlanChange} hitSlop={8}>
                <X size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          )}

          {/* Row 4: Dedicated Mode Toggle Row (Unboxed) */}
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
                      color: isScheduledSwitch && !activeToggleValue
                        ? '#FDE68A'
                        : isOverBudget
                        ? OVER_BUDGET_CORAL
                        : 'rgba(255, 255, 255, 0.85)',
                      fontFamily: (isScheduledSwitch && !activeToggleValue) || isOverBudget
                        ? FontFamily.semibold
                        : FontFamily.medium,
                    },
                  ]}
                >
                  {isScheduledSwitch && !activeToggleValue
                    ? 'Switching to Pure Mode tomorrow · Tap to cancel'
                    : overspendHint}
                </Text>
              </View>
            </View>
            <AnimatedToggle
              value={activeToggleValue}
              onValueChange={handleToggle}
              width={52}
              height={26}
              onColor="#FFFFFF"
              offColor="#FFFFFF"
              trackColor="rgba(255, 255, 255, 0.2)"
            />
          </View>
        </View>
    </View>
  );
});
