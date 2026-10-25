import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  Animated,
  Easing,
  useAnimatedValue,
} from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { PressableOpacity } from './ui/PressableOpacity';
import X from 'lucide-react-native/icons/x';
import Check from 'lucide-react-native/icons/check';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Wallet from 'lucide-react-native/icons/wallet';
import PlusCircle from 'lucide-react-native/icons/circle-plus';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
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
import { Spacing, Motion } from '../config/theme';
import { styles } from './DepositGullakModal.styles';

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
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'source' | 'amount'>('source');
  const [isForward, setIsForward] = useState(true);
  const stepAnim = useAnimatedValue(1);
  const [source, setSource] = useState<GullakDepositSource>('external');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showExplainer, setShowExplainer] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationScale = useAnimatedValue(0.8);
  const celebrationOpacity = useAnimatedValue(0);
  const sheetAnim = useAnimatedValue(0);

  const goToStep = useCallback((nextStep: 'source' | 'amount') => {
    setIsForward(nextStep === 'amount');
    setStep(nextStep);
    if (!reduceMotion) {
      stepAnim.setValue(0);
      Animated.spring(stepAnim, {
        toValue: 1,
        stiffness: Motion.springs.sheet.stiffness,
        damping: Motion.springs.sheet.damping,
        mass: Motion.springs.sheet.mass,
        useNativeDriver: true,
      }).start();
    }
  }, [reduceMotion, stepAnim]);

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
      setIsForward(true);
      stepAnim.setValue(1);
      setSource('external');
      setAmount('');
      setNote('');
      setIsCelebrating(false);
      celebrationScale.setValue(0.8);
      celebrationOpacity.setValue(0);
      if (reduceMotion) {
        sheetAnim.setValue(1);
      } else {
        sheetAnim.setValue(0);
        Animated.spring(sheetAnim, {
          toValue: 1,
          stiffness: Motion.springs.sheet.stiffness,
          damping: Motion.springs.sheet.damping,
          mass: Motion.springs.sheet.mass,
          useNativeDriver: true,
        }).start();
      }
    } else {
      if (reduceMotion) {
        sheetAnim.setValue(0);
        setIsMounted(false);
      } else {
        Animated.timing(sheetAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
          useNativeDriver: true,
        }).start(() => {
          setIsMounted(false);
        });
      }
    }
  }, [visible, celebrationScale, celebrationOpacity, sheetAnim, reduceMotion, stepAnim]);

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
          stiffness: Motion.springs.settle.stiffness,
          damping: Motion.springs.settle.damping,
          mass: Motion.springs.settle.mass,
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
        >
          {/* Violet Gradient Backdrop matching Gullak Hero Card */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient id="depositModalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8B5CF6" />
                  <Stop offset="100%" stopColor="#581C87" />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="100" fill="url(#depositModalGrad)" />
            </Svg>
          </View>

          {step === 'source' ? (
            /* STEP 1: SELECT SOURCE */
            <Animated.View
              style={{
                opacity: reduceMotion
                  ? 1
                  : stepAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 1],
                    }),
                transform: [
                  {
                    scale: reduceMotion
                      ? 1
                      : stepAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1],
                        }),
                  },
                  {
                    translateY: reduceMotion
                      ? 0
                      : stepAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [isForward ? -8 : 8, 0],
                        }),
                  },
                ],
              }}
            >
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
                <PressableOpacity
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
                </PressableOpacity>
              </View>

              {/* Source Option 1: From Income */}
              <PressableOpacity
                style={styles.sourceRow}
                onPress={() => {
                  setSource('income');
                  goToStep('amount');
                }}
                activeOpacity={0.85}
              >
                <GradientIconBadge size={48} color="#4CAF7D" isDark={isDark}>
                  {({ iconColor }) => <Wallet size={22} color={iconColor} strokeWidth={2.2} />}
                </GradientIconBadge>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceTitleRow}>
                    <Text
                      style={[styles.sourceTitle, { color: '#FFFFFF' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
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
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {formatCurrency(availableIncome)} avail.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sourceDesc, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                    Use available income. Doesn't affect your active budget.
                  </Text>
                </View>
                <ChevronRight size={18} color="rgba(255, 255, 255, 0.7)" strokeWidth={2.2} />
              </PressableOpacity>

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
              <PressableOpacity
                style={styles.sourceRow}
                onPress={() => {
                  setSource('external');
                  goToStep('amount');
                }}
                activeOpacity={0.85}
              >
                <GradientIconBadge size={48} color="#3B82F6" isDark={isDark}>
                  {({ iconColor }) => <PlusCircle size={22} color={iconColor} strokeWidth={2.2} />}
                </GradientIconBadge>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceTitleRow}>
                    <Text
                      style={[styles.sourceTitle, { color: '#FFFFFF' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
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
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        New Funds
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sourceDesc, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                    From bank account or cash. Adds directly to Gullak.
                  </Text>
                </View>
                <ChevronRight size={18} color="rgba(255, 255, 255, 0.7)" strokeWidth={2.2} />
              </PressableOpacity>

              {/* Cancel Button */}
              <PressableOpacity
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
              </PressableOpacity>
            </Animated.View>
          ) : (
            /* STEP 2: ENTER AMOUNT & NOTE WITH IN-APP KEYPAD */
            <Animated.View
              style={{
                width: '100%',
                opacity: reduceMotion
                  ? 1
                  : stepAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 1],
                    }),
                transform: [
                  {
                    scale: reduceMotion
                      ? 1
                      : stepAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1],
                        }),
                  },
                  {
                    translateY: reduceMotion
                      ? 0
                      : stepAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [isForward ? 8 : -8, 0],
                        }),
                  },
                ],
              }}
            >
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.titleWithIcon}>
                    <PressableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        goToStep('source');
                      }}
                      hitSlop={8}
                      style={[
                        styles.stepBackBtn,
                        {
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Back to source selection"
                    >
                      <ArrowLeft size={16} color="#FFFFFF" />
                    </PressableOpacity>
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
                  <PressableOpacity
                    onPress={onClose}
                    hitSlop={12}
                    style={[
                      styles.closeBtn,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Close deposit dialog"
                  >
                    <X size={18} color="#FFFFFF" />
                  </PressableOpacity>
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
                <PressableOpacity
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
                </PressableOpacity>

                {/* Preset Quick Chips */}
                <View style={styles.presetsRow}>
                  {PRESET_AMOUNTS.map((preset) => (
                    <PressableOpacity
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
                    </PressableOpacity>
                  ))}
                  {source === 'income' && availableIncome > 0 && (
                    <PressableOpacity
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
                    </PressableOpacity>
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
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                {/* In-App Custom Keypad */}
                <KeypadGrid
                  onKeyPress={handleKeyPress}
                  hasOperators
                  buttonHeight={46}
                  fontSize={20}
                  gap={6}
                  style={{ marginBottom: Spacing.surface }}
                />

                {/* Single Full-Width Primary Action */}
                <PressableOpacity
                  style={[
                    styles.fullWidthSaveBtn,
                    {
                      backgroundColor: isValidAmount ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                      borderColor: isValidAmount ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
                      opacity: isValidAmount ? 1 : 0.6,
                    },
                  ]}
                  onPress={handleDeposit}
                  disabled={!isValidAmount}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isValidAmount
                      ? `Deposit ${formatCurrency(evaluatedAmount)} to Gullak`
                      : 'Deposit to Gullak'
                  }
                >
                  <Check size={18} color={isValidAmount ? '#581C87' : 'rgba(255, 255, 255, 0.4)'} />
                  <Text
                    style={[
                      styles.fullWidthSaveText,
                      { color: isValidAmount ? '#581C87' : 'rgba(255, 255, 255, 0.4)' },
                    ]}
                  >
                    {isValidAmount
                      ? `Deposit ${formatCurrency(evaluatedAmount)}`
                      : 'Deposit to Gullak'}
                  </Text>
                </PressableOpacity>
              </ScrollView>
            </Animated.View>
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
                <Svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={StyleSheet.absoluteFill}
                >
                  <Defs>
                    <SvgLinearGradient id="celebModalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#8B5CF6" />
                      <Stop offset="100%" stopColor="#581C87" />
                    </SvgLinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100" height="100" fill="url(#celebModalGrad)" />
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

