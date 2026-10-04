import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  Animated,
  useAnimatedValue,
} from 'react-native';
import { X, Check, ArrowLeft, Wallet, PlusCircle, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

import { useDailyBudgetStore, GullakDepositSource } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon, AnimatedPiggyBank } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
import { KeypadGrid } from './ui/KeypadGrid';
import { MoneyHelpBadge, MoneyExplainerModal } from './MoneyExplainerModal';
import { formatAmountWithCommas, formatCurrency } from '../lib/formatters';
import {
  applyKeypadPress,
  evaluateExpression,
  formatExpressionWithCommas,
} from '../lib/amountKeypad';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

export interface DepositGullakModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [100, 500, 1000, 2000] as const;

export const DepositGullakModal: React.FC<DepositGullakModalProps> = ({
  visible,
  onClose,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'source' | 'amount'>('source');
  const [source, setSource] = useState<GullakDepositSource>('external');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showExplainer, setShowExplainer] = useState(false);
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationScale = useAnimatedValue(0.8);
  const celebrationOpacity = useAnimatedValue(0);
  const sheetAnim = useAnimatedValue(0);

  const [isMounted, setIsMounted] = useState(visible);
  const addGullakDeposit = useDailyBudgetStore((s) => s.addGullakDeposit);
  const getAvailableIncomeBalance = useDailyBudgetStore((s) => s.getAvailableIncomeBalance);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const expenses = useExpenseStore((s) => s.expenses);
  const availableIncome = useMemo(
    () => getAvailableIncomeBalance(),
    [getAvailableIncomeBalance, expenses, gullakDeposits]
  );
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      setIsMounted(true);
      setStep('source');
      setSource('external');
      setAmount('');
      setNote('');
      setIsCelebrating(false);
      celebrationScale.setValue(0.8);
      celebrationOpacity.setValue(0);
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, celebrationScale, celebrationOpacity, sheetAnim]);

  const {
    result: evaluatedAmount,
    isDivisionByZero,
    hasOperator,
  } = useMemo(() => evaluateExpression(amount), [amount]);

  const formattedExpression = useMemo(() => formatExpressionWithCommas(amount), [amount]);

  const hasValidNum = evaluatedAmount > 0 && !isDivisionByZero;
  const isExceedingIncome = source === 'income' && hasValidNum && evaluatedAmount > availableIncome;
  const isValidAmount = hasValidNum && !isExceedingIncome;

  const handleKeyPress = useCallback((val: string) => {
    Keyboard.dismiss();
    setAmount((prev) => applyKeypadPress(prev, val));
  }, []);

  const handleChipPress = useCallback((preset: number) => {
    Keyboard.dismiss();
    setAmount(String(preset));
  }, []);

  const handleMaxIncomePress = useCallback(() => {
    Keyboard.dismiss();
    if (availableIncome > 0) {
      setAmount(String(Math.round(availableIncome * 100) / 100));
    }
  }, [availableIncome]);

  const handleDeposit = useCallback(() => {
    if (isValidAmount && !isCelebrating) {
      Keyboard.dismiss();
      setIsCelebrating(true);
      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        addGullakDeposit(evaluatedAmount, note.trim(), source);
        setIsCelebrating(false);
        onClose();
      }, 720);
    }
  }, [isValidAmount, isCelebrating, evaluatedAmount, note, source, addGullakDeposit, onClose, celebrationScale, celebrationOpacity]);

  if (!isMounted) return null;

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.modalOverlay,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, Spacing.element),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: '#581C87',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              transform: [
                {
                  translateY: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
              opacity: sheetAnim,
            },
          ]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0 && (width !== modalSize.width || height !== modalSize.height)) {
              setModalSize({ width, height });
            }
          }}
        >
          {/* Violet Gradient Backdrop matching Gullak Hero Card */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg
              key={`deposit_modal_${modalSize.width}_${modalSize.height}`}
              width={modalSize.width || '100%'}
              height={modalSize.height ? modalSize.height + 6 : '100%'}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient id="depositModalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8B5CF6" />
                  <Stop offset="100%" stopColor="#581C87" />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={modalSize.width || '100%'}
                height={modalSize.height ? modalSize.height + 6 : '100%'}
                fill="url(#depositModalGrad)"
              />
            </Svg>
          </View>

          {step === 'source' ? (
            /* STEP 1: SELECT SOURCE */
            <>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleWithIcon}>
                  <GradientIconBadge size={44} color="#ADEBB3" isDark={isDark}>
                    {({ iconColor }) => <PiggyBankCoinIcon size={22} color={iconColor} />}
                  </GradientIconBadge>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>
                        Deposit to Gullak
                      </Text>
                      <MoneyHelpBadge
                        size={18}
                        style={{ marginLeft: Spacing.element }}
                        onPress={() => setShowExplainer(true)}
                      />
                    </View>
                    <Text style={[styles.modalSubtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                      Choose where the money comes from
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={12}
                  style={[
                    styles.closeBtn,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    },
                  ]}
                >
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Source Option 1: From Income */}
              <TouchableOpacity
                style={styles.sourceRow}
                onPress={() => {
                  setSource('income');
                  setStep('amount');
                }}
                activeOpacity={0.7}
              >
                <GradientIconBadge size={48} color="#4CAF7D" isDark={isDark}>
                  {({ iconColor }) => <Wallet size={22} color={iconColor} strokeWidth={2.2} />}
                </GradientIconBadge>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceTitleRow}>
                    <Text style={[styles.sourceTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                      From Income
                    </Text>
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: 'rgba(173, 235, 179, 0.18)',
                          borderColor: 'rgba(173, 235, 179, 0.45)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: '#ADEBB3' },
                        ]}
                        numberOfLines={1}
                      >
                        {formatCurrency(availableIncome)} avail.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sourceDesc, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                    Use tracked earnings. Keeps your All budget unchanged.
                  </Text>
                </View>
                <ChevronRight size={18} color="rgba(255, 255, 255, 0.7)" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Inset Hairline Divider */}
              <View
                style={[
                  styles.rowDivider,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  },
                ]}
              />

              {/* Source Option 2: Add New Money */}
              <TouchableOpacity
                style={styles.sourceRow}
                onPress={() => {
                  setSource('external');
                  setStep('amount');
                }}
                activeOpacity={0.7}
              >
                <GradientIconBadge size={48} color="#3B82F6" isDark={isDark}>
                  {({ iconColor }) => <PlusCircle size={22} color={iconColor} strokeWidth={2.2} />}
                </GradientIconBadge>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceTitleRow}>
                    <Text style={[styles.sourceTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                      Add New Money
                    </Text>
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: 'rgba(147, 197, 253, 0.22)',
                          borderColor: 'rgba(147, 197, 253, 0.45)',
                        },
                      ]}
                    >
                      <Text
                        style={[styles.badgeText, { color: '#BFDBFE' }]}
                        numberOfLines={1}
                      >
                        New Funds
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sourceDesc, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                    Fresh cash, bonus, or savings. Adds to your available balance.
                  </Text>
                </View>
                <ChevronRight size={18} color="rgba(255, 255, 255, 0.7)" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={[
                  styles.fullWidthCancelBtn,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: '#FFFFFF' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* STEP 2: ENTER AMOUNT & NOTE WITH IN-APP KEYPAD */
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleWithIcon}>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep('source');
                    }}
                    hitSlop={8}
                    style={[
                      styles.stepBackBtn,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    ]}
                  >
                    <ArrowLeft size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>
                        {source === 'income' ? 'From Income' : 'Add New Money'}
                      </Text>
                      <MoneyHelpBadge
                        size={18}
                        style={{ marginLeft: Spacing.element }}
                        onPress={() => setShowExplainer(true)}
                      />
                    </View>
                    <Text style={[styles.modalSubtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                      {source === 'income'
                        ? 'Moving tracked income into Gullak'
                        : 'Adding external funds to Gullak'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={12}
                  style={[
                    styles.closeBtn,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    },
                  ]}
                >
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Source Info / Limit Banner */}
              <View
                style={[
                  styles.infoBanner,
                  {
                    backgroundColor: isExceedingIncome
                      ? 'rgba(239, 68, 68, 0.25)'
                      : 'rgba(255, 255, 255, 0.12)',
                    borderColor: isExceedingIncome
                      ? '#EF4444'
                      : 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.infoBannerText,
                    {
                      color: isExceedingIncome
                        ? '#FCA5A5'
                        : '#FFFFFF',
                    },
                  ]}
                >
                  {source === 'income'
                    ? (isExceedingIncome
                        ? `Amount exceeds available income (${formatCurrency(availableIncome)})`
                        : `Available income to deposit: ${formatCurrency(availableIncome)}`)
                    : 'This deposit will also increase your available balance.'}
                </Text>
              </View>

              {/* Amount Display */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Keyboard.dismiss()}
                style={[
                  styles.modalInputRow,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: isExceedingIncome ? '#EF4444' : 'rgba(255, 255, 255, 0.2)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalCurrencySign,
                    {
                      color: isExceedingIncome
                        ? '#FCA5A5'
                        : '#ADEBB3',
                    },
                  ]}
                >
                  ₹
                </Text>
                <View style={styles.amountDisplayWrap}>
                  {hasOperator && (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="head"
                      style={[styles.expressionSubText, { color: 'rgba(255, 255, 255, 0.75)' }]}
                    >
                      {formattedExpression}
                    </Text>
                  )}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.modalAmountText,
                      {
                        color: isDivisionByZero
                          ? '#FCA5A5'
                          : isExceedingIncome
                          ? '#FCA5A5'
                          : '#FFFFFF',
                      },
                    ]}
                  >
                    {isDivisionByZero
                      ? '—'
                      : hasOperator
                      ? formatAmountWithCommas(evaluatedAmount.toString()) || '0'
                      : formatAmountWithCommas(amount) || '0'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Preset Quick Chips */}
              <View style={styles.presetsRow}>
                {PRESET_AMOUNTS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => handleChipPress(preset)}
                    activeOpacity={0.7}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.12)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    ]}
                  >
                    <Text style={[styles.presetChipText, { color: '#FFFFFF' }]}>
                      +₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                    </Text>
                  </TouchableOpacity>
                ))}
                {source === 'income' && availableIncome > 0 && (
                  <TouchableOpacity
                    onPress={handleMaxIncomePress}
                    activeOpacity={0.7}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: 'rgba(173, 235, 179, 0.2)',
                        borderColor: 'rgba(173, 235, 179, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.presetChipText, { color: '#ADEBB3' }]}>
                      Max
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Note Input */}
              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                  },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder="Note (e.g. Festival gift, Cash savings)"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                maxLength={50}
              />

              {/* In-App Custom Keypad */}
              <KeypadGrid
                onKeyPress={handleKeyPress}
                hasOperators
                buttonHeight={46}
                fontSize={20}
                style={{ marginBottom: Spacing.block }}
              />

              {/* Actions */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[
                    styles.modalCancelBtn,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep('source');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { color: '#FFFFFF' }]}>
                    Back
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    {
                      backgroundColor: isValidAmount ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)',
                      borderColor: isValidAmount ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                      opacity: isValidAmount ? 1 : 0.5,
                    },
                  ]}
                  onPress={handleDeposit}
                  disabled={!isValidAmount}
                  activeOpacity={0.8}
                >
                  <Check size={18} color={isValidAmount ? '#5B21B6' : 'rgba(255, 255, 255, 0.4)'} />
                  <Text
                    style={[
                      styles.modalSaveText,
                      { color: isValidAmount ? '#5B21B6' : 'rgba(255, 255, 255, 0.4)' },
                    ]}
                  >
                    Deposit
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── Celebration Overlay (Coin Drop & Piggy Bounce) ── */}
          {isCelebrating && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.celebrationOverlay,
                {
                  backgroundColor: '#581C87',
                  opacity: celebrationOpacity,
                  transform: [{ scale: celebrationScale }],
                },
              ]}
              pointerEvents="auto"
            >
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width="100%" height="100%">
                  <Defs>
                    <SvgLinearGradient id="celebModalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#8B5CF6" />
                      <Stop offset="100%" stopColor="#581C87" />
                    </SvgLinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#celebModalGrad)" />
                </Svg>
              </View>
              <View style={[styles.celebrationCircle, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
                <AnimatedPiggyBank
                  size={58}
                  color="#ADEBB3"
                  coinColor="#F59E0B"
                  triggerKey={isCelebrating ? 1 : 0}
                />
              </View>
              <Text
                style={[
                  styles.celebrationAmount,
                  { color: '#ADEBB3' },
                ]}
              >
                +{formatCurrency(evaluatedAmount)}
              </Text>
              <Text style={[styles.celebrationTitle, { color: '#FFFFFF' }]}>
                Saved in Gullak!
              </Text>
              <Text style={[styles.celebrationSub, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                {source === 'income' ? 'Allocated from income' : 'Added to your savings'}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      <MoneyExplainerModal
        visible={showExplainer}
        topic="deposit_sources"
        onClose={() => setShowExplainer(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
    position: 'relative',
    overflow: 'hidden',
  },
  celebrationOverlay: {
    borderRadius: BorderRadius.cardLarge,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.surface,
    zIndex: 10,
  },
  celebrationCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.surface,
  },
  celebrationAmount: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    marginBottom: Spacing.nano,
  },
  celebrationTitle: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
    marginBottom: Spacing.micro,
  },
  celebrationSub: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.block,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    flex: 1,
  },
  stepBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
  },
  modalSubtitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.nano,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.micro,
    gap: Spacing.group,
  },
  rowDivider: {
    height: 1,
    marginVertical: 4,
    marginLeft: 48 + Spacing.group,
  },
  sourceTextWrap: {
    flex: 1,
  },
  sourceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sourceTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    flexShrink: 1,
    marginRight: Spacing.element,
  },
  sourceDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 17,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
  },
  fullWidthCancelBtn: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.surface,
  },
  infoBanner: {
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element + 2,
    marginBottom: Spacing.element + 2,
  },
  infoBannerText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    height: ControlHeight.row,
    marginBottom: Spacing.element,
  },
  modalCurrencySign: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
    marginRight: Spacing.micro,
  },
  amountDisplayWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  expressionSubText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: 1,
  },
  modalAmountText: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: Spacing.micro,
    marginBottom: Spacing.element,
  },
  presetChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    height: 44,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.element + 2,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.element,
  },
  modalCancelBtn: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.semibold,
  },
  modalSaveBtn: {
    flex: 1.3,
    height: 52,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSaveText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
});
