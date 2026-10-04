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
  useAnimatedValue,
} from 'react-native';
import { Check, X, ArrowLeft, ChevronRight, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';

import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
import { KeypadGrid } from './ui/KeypadGrid';
import { formatAmountWithCommas, formatCurrency, round2 } from '../lib/formatters';
import { applyKeypadPress, KeypadKey } from '../lib/amountKeypad';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight } from '../config/theme';

export interface PeriodRenewalModalProps {
  visible: boolean;
  cadence: 'weekly' | 'monthly';
  budgetAmount: number;
  isAutoRenew: boolean;
  periodStart: string;
  periodEnd: string;
  rolloverSavings?: number;
  onConfirmKeep: () => void;
  onChangeBudget: (newAmount: number) => void;
  onClose: () => void;
}

export const PeriodRenewalModal: React.FC<PeriodRenewalModalProps> = ({
  visible,
  cadence,
  budgetAmount,
  isAutoRenew,
  periodStart,
  periodEnd,
  rolloverSavings = 0,
  onConfirmKeep,
  onChangeBudget,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'celebrate' | 'edit'>('celebrate');
  const [inputAmount, setInputAmount] = useState<string>(() => (budgetAmount > 0 ? String(budgetAmount) : ''));

  // Sync internal mode and amount when modal opens
  useEffect(() => {
    if (visible) {
      if (isAutoRenew && budgetAmount > 0) {
        setMode('celebrate');
      } else {
        setMode('edit');
      }
      setInputAmount(budgetAmount > 0 ? String(budgetAmount) : '');
    }
  }, [visible, isAutoRenew, budgetAmount]);

  const [isMounted, setIsMounted] = useState(visible);

  // Bottom sheet spring physics
  const slideAnim = useAnimatedValue(450);
  const fadeAnim = useAnimatedValue(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      setIsMounted(true);
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
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 450,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const dateRangeLabel = useMemo(() => {
    try {
      if (cadence === 'weekly') {
        const start = parseISO(periodStart);
        const end = parseISO(periodEnd);
        return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
      } else {
        const start = parseISO(periodStart);
        return format(start, 'MMMM yyyy');
      }
    } catch {
      return cadence === 'weekly' ? 'This Week' : 'This Month';
    }
  }, [cadence, periodStart, periodEnd]);

  const presets = useMemo(() => {
    return cadence === 'weekly'
      ? [3000, 5000, 7000, 10000]
      : [15000, 25000, 35000, 50000];
  }, [cadence]);

  const handleKeyPress = useCallback((val: string) => {
    setInputAmount((prev) => applyKeypadPress(prev, val as KeypadKey));
  }, []);

  const handlePresetSelect = useCallback((amount: number) => {
    setInputAmount(String(amount));
  }, []);

  const handleSaveBudget = useCallback(() => {
    const num = round2(parseFloat(inputAmount) || 0);
    if (num > 0) {
      onChangeBudget(num);
    } else {
      onClose();
    }
  }, [inputAmount, onChangeBudget, onClose]);

  const cadenceName = cadence === 'weekly' ? 'Week' : 'Month';
  const cadenceNameLower = cadence === 'weekly' ? 'weekly' : 'monthly';

  if (!isMounted) return null;

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Dimmed backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Bottom Sheet Card */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom + 16, 24),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Top Sheet Handle */}
          <View style={styles.handleBar} />

          {/* Close / Back button in top corner */}
          <View style={styles.sheetTopRow}>
            {mode === 'edit' && isAutoRenew && (
              <TouchableOpacity
                onPress={() => setMode('celebrate')}
                style={[styles.circleBtn, { backgroundColor: colors.cardSubtle }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowLeft size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={onClose}
              style={[styles.circleBtn, { backgroundColor: colors.cardSubtle }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {mode === 'celebrate' ? (
            /* ── Celebrate Auto-Renew Mode ── */
            <View style={styles.contentWrap}>
              {/* Badge Icon */}
              <View style={styles.iconCenterWrap}>
                <GradientIconBadge size={64} color="#ADEBB3" isDark={isDark}>
                  {({ iconColor }) => <PiggyBankCoinIcon size={32} color={iconColor} />}
                </GradientIconBadge>
              </View>

              {/* Rollover Savings Pill (if unspent rolled over) */}
              {rolloverSavings > 0 && (
                <View style={styles.rolloverHighlightPill}>
                  <Sparkles size={14} color="#15803D" />
                  <Text style={styles.rolloverHighlightText}>
                    +{formatCurrency(rolloverSavings)} deposited to Gullak!
                  </Text>
                </View>
              )}

              {/* Title & Date */}
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {`New ${cadenceName}, Fresh Budget`}
              </Text>
              <View style={styles.datePillRow}>
                <View style={[styles.datePill, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
                  <Text style={[styles.datePillText, { color: colors.textSecondary }]}>
                    {dateRangeLabel}
                  </Text>
                </View>
              </View>

              {/* Explanation & Renewed Amount */}
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {`Your ₹${formatAmountWithCommas(String(budgetAmount))} ${cadenceNameLower} allowance is active for this period.`}
              </Text>

              {/* Actions */}
              <View style={styles.actionButtonsWrap}>
                {/* Primary: Keep ₹X */}
                <TouchableOpacity
                  style={[styles.primaryCta, { backgroundColor: colors.mintGreen }]}
                  onPress={onConfirmKeep}
                  activeOpacity={0.8}
                >
                  <Check size={20} color="#1A2B4C" strokeWidth={2.5} />
                  <Text style={styles.primaryCtaText}>
                    {`Keep ₹${formatAmountWithCommas(String(budgetAmount))}`}
                  </Text>
                </TouchableOpacity>

                {/* Secondary: Change Budget */}
                <TouchableOpacity
                  style={[styles.secondaryCta, { borderColor: colors.border }]}
                  onPress={() => setMode('edit')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.secondaryCtaText, { color: colors.textPrimary }]}>
                    Change Budget
                  </Text>
                  <ChevronRight size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Set / Edit Budget Mode ── */
            <ScrollView
              contentContainerStyle={styles.editContentWrap}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {`Set Your ${cadenceName} Budget`}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {`Choose your spending pool for ${dateRangeLabel}.`}
              </Text>

              {/* Displayed Amount Entry */}
              <View style={[styles.amountDisplayRow, { backgroundColor: colors.cardSubtle }]}>
                <Text style={[styles.amountCurrency, { color: colors.textSecondary }]}>₹</Text>
                <Text
                  style={[
                    styles.amountValue,
                    { color: inputAmount ? colors.textPrimary : colors.textMuted },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {inputAmount ? formatAmountWithCommas(inputAmount) : '0'}
                </Text>
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
                {presets.map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor:
                          inputAmount === String(val)
                            ? colors.mintGreen
                            : colors.cardSubtle,
                        borderColor:
                          inputAmount === String(val)
                            ? colors.mintGreen
                            : colors.border,
                      },
                    ]}
                    onPress={() => handlePresetSelect(val)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color:
                            inputAmount === String(val)
                              ? '#1A2B4C'
                              : colors.textPrimary,
                          fontFamily:
                            inputAmount === String(val)
                              ? FontFamily.bold
                              : FontFamily.medium,
                        },
                      ]}
                    >
                      {`₹${formatAmountWithCommas(String(val))}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Numeric Keypad */}
              <View style={styles.keypadWrap}>
                <KeypadGrid
                  onKeyPress={handleKeyPress}
                  buttonHeight={50}
                  fontSize={20}
                />
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={[
                  styles.primaryCta,
                  {
                    backgroundColor: colors.mintGreen,
                    opacity: parseFloat(inputAmount) > 0 ? 1 : 0.5,
                  },
                ]}
                onPress={handleSaveBudget}
                disabled={parseFloat(inputAmount) <= 0}
                activeOpacity={0.8}
              >
                <Check size={20} color="#1A2B4C" strokeWidth={2.5} />
                <Text style={styles.primaryCtaText}>
                  {`Set ${formatCurrency(parseFloat(inputAmount) || 0)} Budget`}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.group,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.35)',
    alignSelf: 'center',
    marginBottom: Spacing.element,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.element,
  },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.group,
  },
  iconCenterWrap: {
    marginBottom: Spacing.group,
  },
  rolloverHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: Spacing.element,
  },
  rolloverHighlightText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    color: '#15803D',
  },
  sheetTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.micro,
  },
  datePillRow: {
    marginBottom: Spacing.element,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  datePillText: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
  },
  sheetSubtitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: Spacing.block,
    marginBottom: Spacing.gutter,
    lineHeight: LineHeight.bodySmall,
  },
  actionButtonsWrap: {
    width: '100%',
    gap: Spacing.group,
  },
  primaryCta: {
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  primaryCtaText: {
    fontSize: FontSize.titleSmall,
    lineHeight: LineHeight.titleSmall,
    fontFamily: FontFamily.bold,
    color: '#1A2B4C',
  },
  secondaryCta: {
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  secondaryCtaText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.semibold,
  },
  editContentWrap: {
    alignItems: 'center',
    paddingBottom: Spacing.element,
  },
  amountDisplayRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.input,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: Spacing.group,
  },
  amountCurrency: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    marginRight: 6,
  },
  amountValue: {
    fontSize: 34,
    fontFamily: FontFamily.bold,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.group,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: FontSize.caption,
  },
  keypadWrap: {
    width: '100%',
    gap: 8,
    marginBottom: Spacing.block,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
});
