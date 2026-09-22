import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { X, Check } from 'lucide-react-native';

import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { formatAmountWithCommas, cleanAmountString, formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

export interface BudgetEditModalProps {
  visible: boolean;
  mode?: 'recurring';
  initialAmount: number;
  onClose: () => void;
}

export const BudgetEditModal: React.FC<BudgetEditModalProps> = ({
  visible,
  initialAmount,
  onClose,
}) => {
  const { colors } = useTheme();
  const [inputBudget, setInputBudget] = useState('');

  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const setDailyBudget = useDailyBudgetStore((s) => s.setDailyBudget);
  const scheduleNextDailyBudget = useDailyBudgetStore((s) => s.scheduleNextDailyBudget);

  // Sync internal input string whenever modal becomes visible or initialAmount changes
  useEffect(() => {
    if (visible) {
      const rawVal = initialAmount > 0 ? String(initialAmount) : '';
      setInputBudget(rawVal ? formatAmountWithCommas(rawVal) : '');
    }
  }, [visible, initialAmount]);

  const handleSave = useCallback(() => {
    const num = parseFloat(cleanAmountString(inputBudget));
    if (isNaN(num) || num < 0) {
      onClose();
      return;
    }

    // If daily budget is already configured and user is changing it
    if (dailyBudgetAmount > 0 && num !== dailyBudgetAmount) {
      Alert.alert(
        'Change Daily Budget?',
        `Your new daily budget (${formatCurrency(num)}) will take effect tomorrow at 12:00 AM. Today's budget (${formatCurrency(dailyBudgetAmount)}) will remain active.\n\nDo you want to confirm?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Change',
            onPress: () => {
              scheduleNextDailyBudget(num);
              onClose();
            },
          },
        ]
      );
      return;
    }

    // Setting for the first time or same amount
    setDailyBudget(num);
    onClose();
  }, [inputBudget, dailyBudgetAmount, setDailyBudget, scheduleNextDailyBudget, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {dailyBudgetAmount > 0 ? 'Change Daily Budget' : 'Set Daily Budget'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            {dailyBudgetAmount > 0
              ? 'New daily budget takes effect tomorrow at 12:00 AM. Today’s allowance remains active.'
              : 'How much would you like to budget for daily spending?'}
          </Text>

          <View style={[styles.modalInputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.modalCurrencySign, { color: colors.textPrimary }]}>₹</Text>
            <TextInput
              style={[styles.modalTextInput, { color: colors.textPrimary }]}
              keyboardType="numeric"
              value={inputBudget}
              onChangeText={(val) => setInputBudget(formatAmountWithCommas(val))}
              placeholder="500"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
          </View>

          <View style={styles.modalActionRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: colors.mintGreen }]}
              onPress={handleSave}
            >
              <Check size={18} color={colors.forestGreen} style={{ marginRight: 6 }} />
              <Text style={[styles.modalSaveText, { color: colors.forestGreen }]}>
                Save Budget
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.gutter,
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius.card,
    padding: 22,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.element,
  },
  modalTitle: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginBottom: 18,
    lineHeight: 18,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.group,
    marginBottom: Spacing.surface,
  },
  modalCurrencySign: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
    marginRight: 6,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: FontFamily.bold,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.group,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.group,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modalSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.group,
    borderRadius: BorderRadius.input,
  },
  modalSaveText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
