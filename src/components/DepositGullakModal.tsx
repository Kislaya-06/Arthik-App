import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Check } from 'lucide-react-native';

import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { formatAmountWithCommas, cleanAmountString } from '../lib/formatters';
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
  const { colors, isDark } = useTheme();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const addGullakDeposit = useDailyBudgetStore((s) => s.addGullakDeposit);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setNote('');
    }
  }, [visible]);

  const handleChipPress = useCallback((preset: number) => {
    setAmount(formatAmountWithCommas(String(preset)));
  }, []);

  const handleDeposit = useCallback(() => {
    const clean = cleanAmountString(amount);
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) {
      addGullakDeposit(num, note);
      onClose();
    }
  }, [amount, note, addGullakDeposit, onClose]);

  const cleanVal = cleanAmountString(amount);
  const isValidAmount = !isNaN(parseFloat(cleanVal)) && parseFloat(cleanVal) > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
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
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.headerIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
                <PiggyBankCoinIcon size={20} color={colors.mintGreenDark} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Deposit to Gullak
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Add extra savings or cash to your jar
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={[styles.modalInputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.modalCurrencySign, { color: colors.mintGreenDark }]}>₹</Text>
            <TextInput
              style={[styles.modalTextInput, { color: colors.textPrimary }]}
              keyboardType="numeric"
              value={amount}
              onChangeText={(val) => setAmount(formatAmountWithCommas(val))}
              placeholder="500"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              maxLength={12}
            />
          </View>

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

          {/* Actions */}
          <View style={styles.modalActionRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                Cancel
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.gutter,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
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
  modalTextInput: {
    flex: 1,
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
    height: '100%',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: Spacing.micro,
    marginBottom: Spacing.block,
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
    height: 42,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.gutter,
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
