import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { ShieldAlert, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../store/themeStore';
import { GradientIconBadge } from './GradientIconBadge';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

export interface VaultSpendingGuardModalProps {
  visible: boolean;
  onClose: () => void;
  onAddIncomeFirst: () => void;
  isBudgetMode: boolean;
  totalVaultLiquidity: number;
}

export const VaultSpendingGuardModal: React.FC<VaultSpendingGuardModalProps> = ({
  visible,
  onClose,
  onAddIncomeFirst,
  isBudgetMode,
  totalVaultLiquidity,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
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
              paddingBottom: Math.max(insets.bottom + Spacing.block, Spacing.gutter),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Subtle Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]} />
          </View>

          {/* Close Icon */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Centered Graphic */}
          <View style={styles.iconWrapper}>
            <GradientIconBadge size={64} color="#FBBF24" isDark={isDark}>
              {({ iconColor }) => <ShieldAlert size={30} color={iconColor} />}
            </GradientIconBadge>
          </View>

          {/* Typography */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Vault Balance Empty
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {isBudgetMode
              ? 'Your active budget allowance and available funds are at ₹0. To maintain financial accuracy, add an Income or set a budget before recording outflows.'
              : 'Every rupee in Arthik represents real money. Your available balance is ₹0, so an expense outflow cannot be recorded without available funds. Please log an Income first.'}
          </Text>

          {/* Inline Balance Indicator (Clean, Uncluttered) */}
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
              Available Liquidity: ₹0
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: isDark ? colors.mintGreen : colors.forestGreen }]}
              onPress={onAddIncomeFirst}
              activeOpacity={0.85}
            >
              <Plus size={18} color={isDark ? colors.forestGreen : '#FFFFFF'} strokeWidth={2.5} />
              <Text style={[styles.primaryButtonText, { color: isDark ? colors.forestGreen : '#FFFFFF' }]}>+ Add Income First</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
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
  },
  iconWrapper: {
    marginTop: Spacing.element,
    marginBottom: Spacing.block,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sectionTitle,
    textAlign: 'center',
    marginBottom: Spacing.element,
  },
  description: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.bodySmall,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: Spacing.element,
    marginBottom: Spacing.surface,
  },
  statusPill: {
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginBottom: Spacing.gutter,
  },
  statusLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.element,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: '#FFFFFF',
  },
  cancelButton: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.bodySmall,
  },
});
