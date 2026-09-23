import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { X, Check, ArrowLeft, Wallet, PlusCircle, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyBudgetStore, GullakDepositSource } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { KeyButton } from './KeyButton';
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

const KEYPAD_ROWS = [
  ['1', '2', '3', '÷'],
  ['4', '5', '6', '×'],
  ['7', '8', '9', '−'],
  ['.', '0', 'backspace', '+'],
];

export const DepositGullakModal: React.FC<DepositGullakModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'source' | 'amount'>('source');
  const [source, setSource] = useState<GullakDepositSource>('external');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const addGullakDeposit = useDailyBudgetStore((s) => s.addGullakDeposit);
  const availableIncome = useDailyBudgetStore((s) => s.getAvailableIncomeBalance());

  useEffect(() => {
    if (visible) {
      setStep('source');
      setSource('external');
      setAmount('');
      setNote('');
    }
  }, [visible]);

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
    if (isValidAmount) {
      addGullakDeposit(evaluatedAmount, note.trim(), source);
      onClose();
    }
  }, [isValidAmount, evaluatedAmount, note, source, addGullakDeposit, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.modalOverlay,
          {
            paddingTop: insets.top + (step === 'source' ? 44 : 16),
          },
        ]}
      >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          {step === 'source' ? (
            /* STEP 1: SELECT SOURCE */
            <>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleWithIcon}>
                  <View style={[styles.headerIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
                    <PiggyBankCoinIcon size={20} color={colors.mintGreenDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                      Deposit to Gullak
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                      Choose where the money comes from
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Source Option 1: From Income */}
              <TouchableOpacity
                style={[
                  styles.sourceCard,
                  {
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setSource('income');
                  setStep('amount');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.sourceIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
                  <Wallet size={20} color={colors.mintGreenDark} />
                </View>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceTitleRow}>
                    <Text style={[styles.sourceTitle, { color: colors.textPrimary }]}>
                      From Income
                    </Text>
                    <View style={[styles.badgePill, { backgroundColor: colors.mintGreenSoft }]}>
                      <Text style={[styles.badgeText, { color: isDark ? colors.mintGreen : colors.forestGreen }]}>
                        {formatCurrency(availableIncome)} avail.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sourceDesc, { color: colors.textSecondary }]}>
                    Use tracked earnings. Keeps your All budget unchanged.
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Source Option 2: Add New Money */}
              <TouchableOpacity
                style={[
                  styles.sourceCard,
                  {
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setSource('external');
                  setStep('amount');
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.sourceIconWrap,
                    {
                      backgroundColor: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                    },
                  ]}
                >
                  <PlusCircle size={20} color={isDark ? '#93C5FD' : '#2563EB'} />
                </View>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceTitleRow}>
                    <Text style={[styles.sourceTitle, { color: colors.textPrimary }]}>
                      Add New Money
                    </Text>
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
                        New Funds
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sourceDesc, { color: colors.textSecondary }]}>
                    Fresh cash, bonus, or savings. Adds to your available balance.
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={[styles.fullWidthCancelBtn, { borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
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
                    style={[styles.stepBackBtn, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}
                  >
                    <ArrowLeft size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                      {source === 'income' ? 'From Income' : 'Add New Money'}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                      {source === 'income'
                        ? 'Moving tracked income into Gullak'
                        : 'Adding external funds to Gullak'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Source Info / Limit Banner */}
              <View
                style={[
                  styles.infoBanner,
                  {
                    backgroundColor: isExceedingIncome
                      ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2')
                      : (source === 'income' ? colors.mintGreenSoft : colors.cardSubtle),
                    borderColor: isExceedingIncome ? '#EF4444' : 'transparent',
                    borderWidth: isExceedingIncome ? 1 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.infoBannerText,
                    {
                      color: isExceedingIncome
                        ? (isDark ? '#FCA5A5' : '#DC2626')
                        : (source === 'income' ? (isDark ? colors.mintGreen : colors.forestGreen) : colors.textSecondary),
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
                    backgroundColor: colors.inputBg,
                    borderColor: isExceedingIncome ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalCurrencySign,
                    {
                      color: isExceedingIncome
                        ? '#EF4444'
                        : isDark
                        ? colors.mintGreen
                        : colors.mintGreenDark,
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
                      style={[styles.expressionSubText, { color: colors.textSecondary }]}
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
                          ? '#EF4444'
                          : isExceedingIncome
                          ? '#EF4444'
                          : (hasOperator ? evaluatedAmount > 0 : amount)
                          ? colors.textPrimary
                          : colors.textSecondary,
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
                        backgroundColor: colors.cardSubtle,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.presetChipText, { color: colors.textPrimary }]}>
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
                        backgroundColor: colors.mintGreenSoft,
                        borderColor: colors.mintGreen,
                      },
                    ]}
                  >
                    <Text style={[styles.presetChipText, { color: isDark ? colors.mintGreen : colors.forestGreen }]}>
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
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder="Note (e.g. Festival gift, Cash savings)"
                placeholderTextColor={colors.textSecondary}
                maxLength={50}
              />

              {/* In-App Custom Keypad */}
              <View style={styles.keypadGrid}>
                {KEYPAD_ROWS.map((row, rIdx) => (
                  <View key={rIdx} style={styles.keypadRow}>
                    {row.map((item) => (
                      <KeyButton
                        key={item}
                        item={item}
                        height={46}
                        fontSize={20}
                        onPress={handleKeyPress}
                      />
                    ))}
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep('source');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                    Back
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    {
                      backgroundColor: isValidAmount ? colors.mintGreen : colors.cardSubtle,
                      opacity: isValidAmount ? 1 : 0.6,
                    },
                  ]}
                  onPress={handleDeposit}
                  disabled={!isValidAmount}
                  activeOpacity={0.8}
                >
                  <Check size={16} color={isValidAmount ? colors.forestGreen : colors.textSecondary} />
                  <Text
                    style={[
                      styles.modalSaveText,
                      { color: isValidAmount ? colors.forestGreen : colors.textSecondary },
                    ]}
                  >
                    Deposit
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.element + 4,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    flex: 1,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.card,
    padding: Spacing.element,
    marginBottom: Spacing.element,
    gap: Spacing.element,
  },
  sourceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTextWrap: {
    flex: 1,
  },
  sourceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sourceTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  sourceDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
  },
  fullWidthCancelBtn: {
    height: ControlHeight.row,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.micro,
  },
  infoBanner: {
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.micro + 2,
    marginBottom: Spacing.element,
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
    paddingVertical: 7,
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
    height: 40,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.element + 2,
  },
  keypadGrid: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: Spacing.block,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.element,
  },
  modalCancelBtn: {
    flex: 1,
    height: ControlHeight.row,
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
    height: ControlHeight.row,
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
