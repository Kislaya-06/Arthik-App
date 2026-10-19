import React from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import { PiggyBankCoinIcon } from '../PiggyBankCoinIcon';
import { MoneyHelpBadge } from '../MoneyExplainerModal';
import { Spacing, FontSize, FontFamily } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';

export interface PauseBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  totalAccumulatedSavings: number;
  budgetCadence: string;
  getCarryableAmount?: () => number;
  onTurnOff: () => void;
  onOpenMoneyExplainer: () => void;
  colors: any;
  isDark: boolean;
  styles: any;
}

export const PauseBudgetModal: React.FC<PauseBudgetModalProps> = ({
  visible,
  onClose,
  totalAccumulatedSavings,
  budgetCadence,
  getCarryableAmount,
  onTurnOff,
  onOpenMoneyExplainer,
  colors,
  isDark,
  styles,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <View style={[styles.pauseIconCircle, { backgroundColor: isDark ? 'rgba(244, 184, 174, 0.16)' : '#FDE8E4' }]}>
            <PiggyBankCoinIcon size={24} color={colors.coral} />
          </View>

          <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold, marginBottom: Spacing.element }]}>
            Switch to Pure Mode?
          </Text>

          <Text style={[styles.pauseModalDesc, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            Your Gullak balance ({formatCurrency(totalAccumulatedSavings)}) and streaks stay 100% safe. You can switch back anytime.
          </Text>
          <Text style={[styles.pauseModalDesc, { color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.element }]}>
            {(() => {
              const left = visible && typeof getCarryableAmount === 'function' ? getCarryableAmount() : 0;
              if ((budgetCadence === 'weekly' || budgetCadence === 'monthly') && left > 0) {
                const w = budgetCadence === 'weekly' ? 'week' : 'month';
                return `Your ${formatCurrency(left)} budget stays with this ${w}. Spending in Pure Mode still uses it. Switch back this ${w} and you continue with what's left.`;
              }
              return 'Pure Mode keeps the same books: your budget is used first, then income, then Gullak.';
            })()}
          </Text>

          <TouchableOpacity
            onPress={onOpenMoneyExplainer}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.element, marginBottom: Spacing.group }}
            activeOpacity={0.7}
          >
            <MoneyHelpBadge size={16} onPress={onOpenMoneyExplainer} />
            <Text style={{ marginLeft: 6, fontSize: FontSize.bodySmall, color: isDark ? colors.mintGreen : colors.forestGreen, fontFamily: FontFamily.bold }}>
              See what happens to your funds
            </Text>
          </TouchableOpacity>

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: colors.cardSubtle, borderColor: colors.border, borderWidth: 1 }]}
              onPress={onClose}
            >
              <Text style={[styles.modalCancelText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modalBtn, { backgroundColor: colors.coral }]}
              onPress={onTurnOff}
            >
              <Text style={[styles.modalSaveText, { color: colors.white, fontFamily: FontFamily.bold }]}>
                Switch to Pure Mode
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
