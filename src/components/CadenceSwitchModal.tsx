import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Pressable,
  ScrollView,
} from 'react-native';
import { Check, X, AlertTriangle, ArrowRight, ShieldCheck, Sparkles, Layers, PieChart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { useTheme } from '../store/themeStore';
import { BudgetCadence } from '../types';
import {
  buildCadenceSwitchPlan,
  CadenceCarryMode,
  checkCadenceCapacity,
} from '../lib/cadenceSwitch';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

export interface CadenceSwitchModalProps {
  visible: boolean;
  currentCadence: BudgetCadence;
  targetCadence: BudgetCadence;
  initialTargetAmount: number;
  currentBudget: number;
  currentSpent: number;
  onConfirmSwitch: (params: {
    targetCadence: BudgetCadence;
    amount: number;
    carryMode: CadenceCarryMode;
    carriedOverAmount: number;
  }) => void;
  onClose: () => void;
}

export const CadenceSwitchModal: React.FC<CadenceSwitchModalProps> = ({
  visible,
  currentCadence,
  targetCadence,
  initialTargetAmount,
  currentBudget,
  currentSpent,
  onConfirmSwitch,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const activeAccent = isDark ? colors.mintGreen : colors.forestGreen;
  const activeBg = isDark ? 'rgba(184, 224, 200, 0.12)' : 'rgba(27, 77, 62, 0.07)';

  const [carryMode, setCarryMode] = useState<CadenceCarryMode>('additive');
  const [targetAmount, setTargetAmount] = useState<number>(initialTargetAmount);

  useEffect(() => {
    if (visible) {
      setTargetAmount(initialTargetAmount);
      setCarryMode('additive');
    }
  }, [visible, initialTargetAmount]);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [visible]);

  const plan = useMemo(() => {
    return buildCadenceSwitchPlan({
      currentCadence,
      targetCadence,
      currentBudget,
      currentSpent,
      targetAmount,
      carryMode,
      todayStr,
    });
  }, [currentCadence, targetCadence, currentBudget, currentSpent, targetAmount, carryMode, todayStr]);

  const handleApplySafeAmount = useCallback((amount: number) => {
    setTargetAmount(amount);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirmSwitch({
      targetCadence,
      amount: targetAmount,
      carryMode,
      carriedOverAmount: plan.carriedAmount,
    });
  }, [onConfirmSwitch, targetCadence, targetAmount, carryMode, plan.carriedAmount]);

  if (!visible) return null;

  const currentLabel = currentCadence.charAt(0).toUpperCase() + currentCadence.slice(1);
  const targetLabel = targetCadence.charAt(0).toUpperCase() + targetCadence.slice(1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.scrim, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141416' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              paddingBottom: Math.max(insets.bottom, Spacing.surface),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.transitionBadge,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                    {currentLabel}
                  </Text>
                  <ArrowRight size={12} color={colors.textSecondary} style={{ marginHorizontal: 4 }} />
                  <Text style={[styles.badgeText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                    {targetLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                Switch to {targetLabel} Budget
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
              ]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Unboxed Status Summary */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F9FA',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <View style={styles.metricRow}>
                <View>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Current {currentLabel} Unspent
                  </Text>
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                    {formatCurrency(plan.unspentAmount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Next Gullak Deposit
                  </Text>
                  <Text style={[styles.metricValue, { color: colors.textSecondary }]}>
                    ₹0 (Switch)
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <ShieldCheck size={14} color="#4CAF50" style={{ marginRight: 6 }} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Zero Gullak Deposit: Gullak deposits only occur on natural cycle ends. Your unspent money carries forward 100% safely.
                </Text>
              </View>
            </View>

            {/* Over-Capacity Warning Banner (Audio Clip 2 Edge Case) */}
            {plan.validation.isExceeding && (
              <View
                style={[
                  styles.warningCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 122, 110, 0.12)' : 'rgba(255, 122, 110, 0.08)',
                    borderColor: 'rgba(255, 122, 110, 0.35)',
                  },
                ]}
              >
                <View style={styles.warningHeader}>
                  <AlertTriangle size={16} color="#FF7A6E" style={{ marginRight: 6 }} />
                  <Text style={[styles.warningTitle, { color: '#FF7A6E' }]}>
                    Exceeds Remaining {currentLabel} Budget
                  </Text>
                </View>
                <Text style={[styles.warningBody, { color: colors.textPrimary }]}>
                  {plan.validation.warningMessage}
                </Text>

                {plan.validation.maxSafeWeeklyAmount !== undefined && (
                  <TouchableOpacity
                    style={styles.safeActionPill}
                    activeOpacity={0.8}
                    onPress={() => handleApplySafeAmount(plan.validation.maxSafeWeeklyAmount!)}
                  >
                    <Sparkles size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.safeActionText}>
                      Set Safe Budget: {formatCurrency(plan.validation.maxSafeWeeklyAmount)}/week
                    </Text>
                  </TouchableOpacity>
                )}

                {plan.validation.maxSafeDailyAmount !== undefined && (
                  <TouchableOpacity
                    style={styles.safeActionPill}
                    activeOpacity={0.8}
                    onPress={() => handleApplySafeAmount(plan.validation.maxSafeDailyAmount!)}
                  >
                    <Sparkles size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.safeActionText}>
                      Set Safe Budget: {formatCurrency(plan.validation.maxSafeDailyAmount)}/day
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Carry-Forward Mode Picker */}
            {plan.unspentAmount > 0 && (
              <View style={styles.modeSection}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  How would you like to handle your ₹{formatAmountWithCommas(String(plan.unspentAmount))}?
                </Text>

                {/* Option 1: Additive Pool */}
                <TouchableOpacity
                  style={[
                    styles.modeOptionCard,
                    carryMode === 'additive' && styles.modeOptionCardActive,
                    {
                      backgroundColor:
                        carryMode === 'additive'
                          ? activeBg
                          : isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : '#FAFAFA',
                      borderColor:
                        carryMode === 'additive'
                          ? activeAccent
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCarryMode('additive')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: carryMode === 'additive' }}
                  accessibilityLabel={`Additive Pool, expand limit to ${formatCurrency(plan.targetBudgetAmount + plan.unspentAmount)}`}
                >
                  <View style={styles.modeCardHeader}>
                    <View style={styles.modeIconTitleRow}>
                      <Layers
                        size={16}
                        color={carryMode === 'additive' ? activeAccent : colors.textSecondary}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.modeCardTitle,
                          { color: carryMode === 'additive' ? colors.textPrimary : colors.textSecondary },
                        ]}
                      >
                        Additive Pool (Expand Limit)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        carryMode === 'additive' && styles.radioCircleActive,
                        { borderColor: carryMode === 'additive' ? activeAccent : colors.textSecondary },
                      ]}
                    >
                      {carryMode === 'additive' && (
                        <View style={[styles.radioInner, { backgroundColor: activeAccent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: colors.textSecondary }]}>
                    Adds unspent {formatCurrency(plan.unspentAmount)} on top of your new budget. Total spending pool will be{' '}
                    <Text style={{ fontFamily: FontFamily.bold, color: colors.textPrimary }}>
                      {formatCurrency(plan.targetBudgetAmount + plan.unspentAmount)}
                    </Text>.
                  </Text>
                </TouchableOpacity>

                {/* Option 2: Remaining Allocation */}
                <TouchableOpacity
                  style={[
                    styles.modeOptionCard,
                    carryMode === 'allocation' && styles.modeOptionCardActive,
                    {
                      backgroundColor:
                        carryMode === 'allocation'
                          ? activeBg
                          : isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : '#FAFAFA',
                      borderColor:
                        carryMode === 'allocation'
                          ? activeAccent
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCarryMode('allocation')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: carryMode === 'allocation' }}
                  accessibilityLabel={`Remaining Allocation, keep fixed cap at ${formatCurrency(plan.targetBudgetAmount)}`}
                >
                  <View style={styles.modeCardHeader}>
                    <View style={styles.modeIconTitleRow}>
                      <PieChart
                        size={16}
                        color={carryMode === 'allocation' ? activeAccent : colors.textSecondary}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.modeCardTitle,
                          { color: carryMode === 'allocation' ? colors.textPrimary : colors.textSecondary },
                        ]}
                      >
                        Remaining Allocation (Keep Fixed Cap)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        carryMode === 'allocation' && styles.radioCircleActive,
                        { borderColor: carryMode === 'allocation' ? activeAccent : colors.textSecondary },
                      ]}
                    >
                      {carryMode === 'allocation' && (
                        <View style={[styles.radioInner, { backgroundColor: activeAccent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: colors.textSecondary }]}>
                    Keeps your total pool at{' '}
                    <Text style={{ fontFamily: FontFamily.bold, color: colors.textPrimary }}>
                      {formatCurrency(plan.targetBudgetAmount)}
                    </Text>. Unspent {formatCurrency(plan.unspentAmount)} counts as your opening headstart.
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Next Day Activation Note */}
            <View
              style={[
                styles.activationCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <Text style={[styles.activationText, { color: colors.textSecondary }]}>
                📅 <Text style={{ fontFamily: FontFamily.bold, color: colors.textPrimary }}>Next-Day Activation</Text>: Takes effect tomorrow at 00:00. Today continues under your current {currentLabel} plan.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: activeAccent,
                },
              ]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Confirm Switch"
            >
              <Check size={18} color={isDark ? colors.forestGreen : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.confirmText, { color: isDark ? colors.forestGreen : '#FFFFFF' }]}>Confirm Switch</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '88%',
    paddingTop: Spacing.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.surface,
    marginBottom: Spacing.block,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.micro,
  },
  transitionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },
  sheetTitle: {
    fontSize: FontSize.sectionTitle,
    fontFamily: FontFamily.bold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.surface,
    paddingBottom: Spacing.surface,
  },
  summaryCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.nano,
  },
  metricValue: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.group,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    flex: 1,
    lineHeight: 16,
  },
  warningCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.micro,
  },
  warningTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  warningBody: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
    marginBottom: Spacing.group,
  },
  safeActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7A6E',
    paddingVertical: 10,
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.pill,
  },
  safeActionText: {
    color: '#FFFFFF',
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modeSection: {
    marginBottom: Spacing.block,
  },
  sectionTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
    marginBottom: Spacing.group,
  },
  modeOptionCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.block,
    marginBottom: Spacing.group,
  },
  modeOptionCardActive: {
    borderWidth: 1.5,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.micro,
  },
  modeIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeCardTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modeCardDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {},
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activationCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  activationText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.surface,
    gap: Spacing.group,
  },
  cancelBtn: {
    flex: 1,
    height: ControlHeight.row,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  confirmBtn: {
    flex: 2,
    height: ControlHeight.row,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
});
