import React from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { PiggyBankCoinIcon } from '../PiggyBankCoinIcon';
import { MoneyHelpBadge } from '../MoneyExplainerModal';
import { Spacing, FontSize, FontFamily, BorderRadius, ControlHeight } from '../../config/theme';
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
        style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15, 23, 42, 0.45)' }]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, overflow: 'hidden' }]}
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

          {/* Action Buttons: Stacked to maintain pristine pill geometry, exact 48px height, and zero bulky distortion */}
          <View style={localStyles.modalActions}>
            <TouchableOpacity
              style={[localStyles.switchBtn, { backgroundColor: colors.coral }]}
              onPress={onTurnOff}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Switch to Pure Mode"
            >
              <Text style={localStyles.switchBtnText}>
                Switch to Pure Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                localStyles.cancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.cardSubtle,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.borderSubtle,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[localStyles.cancelBtnText, { color: colors.textPrimary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  modalActions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: Spacing.gutter,
    width: '100%',
  },
  switchBtn: {
    height: ControlHeight.standard, // 48px canonical standard pill height
    borderRadius: BorderRadius.pill, // 9999px perfect stadium pill
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.block,
    width: '100%',
  },
  switchBtnText: {
    color: '#1A2B4C', // Signature dark navy text on coral for 9.8:1 WCAG AAA contrast
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: 0.2,
  },
  cancelBtn: {
    height: ControlHeight.standard, // 48px canonical standard pill height
    borderRadius: BorderRadius.pill, // 9999px perfect stadium pill
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.block,
    borderWidth: 1,
    width: '100%',
  },
  cancelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: 0.2,
  },
});

