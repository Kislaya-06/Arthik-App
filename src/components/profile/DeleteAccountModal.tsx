import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing as REasing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import Trash2 from 'lucide-react-native/icons/trash';
import X from 'lucide-react-native/icons/x';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { Spacing, FontFamily, Motion } from '../../config/theme';

export interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
  deleteEmailInput: string;
  onChangeEmail: (text: string) => void;
  deleteEmailError: string | null;
  isDeleting: boolean;
  deleteBtnBg: string;
  deleteBtnColor: string;
  onConfirm: () => void;
  colors: any;
  isDark: boolean;
  styles: any;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  onClose,
  userEmail,
  deleteEmailInput,
  onChangeEmail,
  deleteEmailError,
  isDeleting,
  deleteBtnBg,
  deleteBtnColor,
  onConfirm,
  colors,
  isDark,
  styles,
}) => {
  const reduceMotion = useReduceMotion();
  const cardScale = useSharedValue(reduceMotion ? 1 : 0.95);
  const cardTranslateY = useSharedValue(reduceMotion ? 0 : 12);
  const cardOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        cardScale.value = 1;
        cardTranslateY.value = 0;
        cardOpacity.value = 1;
        return;
      }
      cardScale.value = withSpring(1, Motion.springs.settle);
      cardTranslateY.value = withSpring(0, Motion.springs.settle);
      cardOpacity.value = withTiming(1, { duration: 160, easing: REasing.bezier(0.23, 1, 0.32, 1) });
    } else {
      cardScale.value = 0.95;
      cardTranslateY.value = 12;
      cardOpacity.value = 0;
    }
  }, [visible, reduceMotion, cardScale, cardTranslateY, cardOpacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }, { translateY: cardTranslateY.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isDeleting) onClose();
      }}
    >
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)' }]}
        onPress={() => {
          if (!isDeleting) onClose();
        }}
      >
        <Animated.View
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2' }, cardAnimatedStyle]}
        >
          {/* Warning Icon Badge */}
          <View style={[styles.deleteWarningIconWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }]}>
            <Trash2 size={22} color="#DC2626" />
          </View>

          <Text style={[styles.deleteModalTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            Delete Account
          </Text>
          <Text style={[styles.deleteModalDesc, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            This action is permanent and cannot be undone. All your recorded expenses, budgets, savings, and custom categories will be completely erased.
          </Text>

          <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            Confirm by typing your registered email:
          </Text>

          {userEmail ? (
            <View style={[styles.deleteEmailBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSubtle, borderColor: colors.border }]}>
              <Text style={[styles.deleteEmailBadgeText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                {userEmail}
              </Text>
            </View>
          ) : null}

          <TextInput
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
                borderColor: deleteEmailError ? '#DC2626' : colors.border,
                fontFamily: FontFamily.medium,
                marginTop: Spacing.nano,
              },
            ]}
            value={deleteEmailInput}
            onChangeText={onChangeEmail}
            placeholder="Enter your email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!isDeleting}
          />

          {deleteEmailError ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(160)}
              exiting={reduceMotion ? undefined : FadeOut.duration(120)}
              layout={reduceMotion ? undefined : LinearTransition.duration(180)}
            >
              <Text style={[styles.deleteErrorText, { color: '#DC2626', fontFamily: FontFamily.medium }]}>
                {deleteEmailError}
              </Text>
            </Animated.View>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: colors.cardSubtle }]}
              onPress={onClose}
              disabled={isDeleting}
            >
              <X size={16} color={colors.textSecondary} />
              <Text style={[styles.modalCancelText, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modalBtn, { backgroundColor: deleteBtnBg }]}
              onPress={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={deleteBtnColor} />
              ) : (
                <>
                  <Trash2 size={16} color={deleteBtnColor} />
                  <Text style={[styles.modalSaveText, { color: deleteBtnColor, fontFamily: FontFamily.bold }]}>
                    Continue
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};
