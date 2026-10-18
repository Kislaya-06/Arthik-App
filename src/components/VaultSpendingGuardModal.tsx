import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useAnimatedValue,
} from 'react-native';
import { ShieldAlert, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../store/themeStore';
import { GradientIconBadge } from './GradientIconBadge';
import { KeypadGrid } from './ui/KeypadGrid';
import { applyKeypadPress } from '../lib/amountKeypad';
import {
  formatCurrency,
  formatAmountWithCommas,
  cleanAmountString,
  round2,
} from '../lib/formatters';
import { VAULT_GUARD_MESSAGE } from '../lib/vaultSpendingGuard';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight } from '../config/theme';

export interface VaultSpendingGuardModalProps {
  visible: boolean;
  onClose: () => void;
  expenseAmount?: number;
  onAddMoneyAndSave?: (addedAmount: number, paymentMode: 'cash' | 'upi') => Promise<void> | void;
  onAddIncomeFirst?: () => void;
  isBudgetMode: boolean;
  totalVaultLiquidity?: number;
}

export const VaultSpendingGuardModal: React.FC<VaultSpendingGuardModalProps> = ({
  visible,
  onClose,
  expenseAmount = 0,
  onAddMoneyAndSave,
  onAddIncomeFirst,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [isMounted, setIsMounted] = useState(visible);
  const [amountStr, setAmountStr] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slideAnim = useAnimatedValue(400);
  const fadeAnim = useAnimatedValue(0);
  const isFirstRender = useRef(true);

  // Sync state on modal open
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      setIsMounted(true);
      setIsSubmitting(false);
      setPaymentMode('upi');
      setAmountStr(expenseAmount > 0 ? String(expenseAmount) : '');

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
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
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, expenseAmount, slideAnim, fadeAnim]);

  const presetChips = useMemo(() => {
    const base = expenseAmount > 0 ? round2(expenseAmount) : 100;
    const chips: number[] = [base];
    const niceRoundNumbers = [100, 200, 500, 1000, 2000, 5000, 10000];
    for (const n of niceRoundNumbers) {
      if (n > base && !chips.includes(n)) {
        chips.push(n);
      }
      if (chips.length >= 4) break;
    }
    if (chips.length < 4) {
      const nextMultiple = Math.ceil(base / 1000) * 1000 + 1000;
      if (!chips.includes(nextMultiple)) chips.push(nextMultiple);
    }
    return chips.slice(0, 4);
  }, [expenseAmount]);

  const evaluatedAddAmount = useMemo(() => {
    const clean = cleanAmountString(amountStr);
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountStr]);

  const minRequired = expenseAmount > 0 ? expenseAmount : 0;
  const isAmountSufficient = evaluatedAddAmount >= minRequired && evaluatedAddAmount > 0;
  const canSave = isAmountSufficient && !isSubmitting;

  const handleKeyPress = useCallback((val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmountStr((prev) =>
      applyKeypadPress(prev, val, { maxIntegerDigits: 8, maxDecimals: 2 })
    );
  }, []);

  const handleSelectChip = useCallback((val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmountStr(String(val));
  }, []);

  const handleConfirm = async () => {
    if (!canSave) return;
    setIsSubmitting(true);
    try {
      if (onAddMoneyAndSave) {
        await onAddMoneyAndSave(evaluatedAddAmount, paymentMode);
      } else if (onAddIncomeFirst) {
        onClose();
        onAddIncomeFirst();
      }
    } catch {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return null;

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              maxHeight: '92%',
              paddingBottom: Math.max(insets.bottom + Spacing.block, Spacing.gutter),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' },
              ]}
            />
          </View>

          {/* Close Icon */}
          <TouchableOpacity
            style={[
              styles.closeButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            ]}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Centered Graphic */}
            <View style={styles.iconWrapper}>
              <GradientIconBadge size={58} color="#FBBF24" isDark={isDark}>
                {({ iconColor }) => <ShieldAlert size={28} color={iconColor} />}
              </GradientIconBadge>
            </View>

            {/* Typography */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Account Balance Exhausted
            </Text>

            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {expenseAmount > 0
                ? `Your vault balance is ₹0. Add money directly to save this ${formatCurrency(expenseAmount)} expense.`
                : VAULT_GUARD_MESSAGE}
            </Text>

            {/* Balance vs Pending Expense Pill */}
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2',
                },
              ]}
            >
              <Text style={[styles.statusLabel, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                Available: ₹0 • Expense: {formatCurrency(expenseAmount)}
              </Text>
            </View>

            {/* Quick Preset Chips */}
            <View style={styles.presetsRow}>
              {presetChips.map((chipVal, idx) => {
                const isSelected = evaluatedAddAmount === chipVal;
                const isExact = idx === 0 && chipVal === expenseAmount;
                return (
                  <TouchableOpacity
                    key={`preset_${chipVal}_${idx}`}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? colors.mintGreen : colors.forestGreen)
                          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        borderColor: isSelected
                          ? (isDark ? colors.mintGreen : colors.forestGreen)
                          : colors.border,
                      },
                    ]}
                    onPress={() => handleSelectChip(chipVal)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected
                            ? (isDark ? colors.forestGreen : '#FFFFFF')
                            : colors.textPrimary,
                          fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                        },
                      ]}
                    >
                      {isExact ? `Exact ₹${formatAmountWithCommas(String(chipVal))}` : `₹${formatAmountWithCommas(String(chipVal))}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Prominent Amount Display */}
            <View
              style={[
                styles.amountDisplayRow,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>₹</Text>
              <Text
                style={[
                  styles.amountDisplayText,
                  {
                    color: amountStr ? colors.textPrimary : colors.textMuted,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {amountStr ? formatAmountWithCommas(amountStr) : '0'}
              </Text>
            </View>

            {/* Added Via Mode Selector */}
            <View style={styles.paymentSection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Add via</Text>
              <View style={styles.paymentPillGroup}>
                <TouchableOpacity
                  style={[
                    styles.paymentPill,
                    paymentMode === 'upi' && {
                      backgroundColor: isDark ? colors.mintGreen : colors.forestGreen,
                      borderColor: isDark ? colors.mintGreen : colors.forestGreen,
                    },
                    paymentMode !== 'upi' && {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPaymentMode('upi');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.paymentPillText,
                      {
                        color: paymentMode === 'upi'
                          ? (isDark ? colors.forestGreen : '#FFFFFF')
                          : colors.textSecondary,
                        fontFamily: paymentMode === 'upi' ? FontFamily.bold : FontFamily.medium,
                      },
                    ]}
                  >
                    UPI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentPill,
                    paymentMode === 'cash' && {
                      backgroundColor: isDark ? colors.mintGreen : colors.forestGreen,
                      borderColor: isDark ? colors.mintGreen : colors.forestGreen,
                    },
                    paymentMode !== 'cash' && {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPaymentMode('cash');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.paymentPillText,
                      {
                        color: paymentMode === 'cash'
                          ? (isDark ? colors.forestGreen : '#FFFFFF')
                          : colors.textSecondary,
                        fontFamily: paymentMode === 'cash' ? FontFamily.bold : FontFamily.medium,
                      },
                    ]}
                  >
                    Cash
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Compact Keypad Grid */}
            <KeypadGrid
              onKeyPress={handleKeyPress}
              buttonHeight={38}
              fontSize={18}
              gap={5}
              style={{ marginBottom: Spacing.element }}
            />

            {/* Helper Validation Text */}
            <View style={styles.helperContainer}>
              {!isAmountSufficient ? (
                <Text style={[styles.helperText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                  Must add at least {formatCurrency(minRequired)} to cover this expense
                </Text>
              ) : (
                <Text style={[styles.helperText, { color: isDark ? colors.mintGreen : colors.forestGreen }]}>
                  ✓ Covers this expense
                  {evaluatedAddAmount > minRequired
                    ? ` (+${formatCurrency(evaluatedAddAmount - minRequired)} left in vault)`
                    : ''}
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: canSave
                      ? (isDark ? colors.mintGreen : colors.forestGreen)
                      : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                    opacity: canSave ? 1 : 0.6,
                  },
                ]}
                onPress={handleConfirm}
                disabled={!canSave || isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color={isDark ? colors.forestGreen : '#FFFFFF'} />
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { color: isDark ? colors.forestGreen : '#FFFFFF' },
                      ]}
                    >
                      Saving Expense...
                    </Text>
                  </>
                ) : (
                  <>
                    <Plus
                      size={18}
                      color={canSave ? (isDark ? colors.forestGreen : '#FFFFFF') : colors.textMuted}
                      strokeWidth={2.5}
                    />
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { color: canSave ? (isDark ? colors.forestGreen : '#FFFFFF') : colors.textMuted },
                      ]}
                    >
                      Add {formatCurrency(evaluatedAddAmount)} & Save Expense
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>
                  Keep Editing / Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    paddingTop: Spacing.group,
    paddingHorizontal: Spacing.gutter,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: Spacing.element,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.nano,
    marginBottom: Spacing.micro,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.block,
    right: Spacing.gutter,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconWrapper: {
    marginTop: Spacing.nano,
    marginBottom: Spacing.element,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    textAlign: 'center',
    marginBottom: Spacing.micro,
  },
  description: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
    paddingHorizontal: Spacing.element,
    marginBottom: Spacing.element,
  },
  statusPill: {
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.nano + 2,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginBottom: Spacing.element,
  },
  statusLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.element,
    justifyContent: 'center',
    marginBottom: Spacing.element,
    width: '100%',
  },
  presetChip: {
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.nano + 2,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
  },
  amountDisplayRow: {
    width: '100%',
    height: 48,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.block,
    marginBottom: Spacing.element,
  },
  currencySymbol: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.titleMedium,
    marginRight: Spacing.micro,
  },
  amountDisplayText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.titleMedium,
  },
  paymentSection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.element,
    paddingHorizontal: Spacing.micro,
  },
  sectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
  },
  paymentPillGroup: {
    flexDirection: 'row',
    gap: Spacing.element,
  },
  paymentPill: {
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.nano + 1,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentPillText: {
    fontSize: FontSize.caption,
  },
  helperContainer: {
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.element,
  },
  helperText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.element,
  },
  primaryButton: {
    width: '100%',
    height: ControlHeight.standard,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },
  cancelButton: {
    width: '100%',
    height: ControlHeight.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.bodySmall,
  },
});
