import React, { useState, useEffect } from 'react';
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
import X from 'lucide-react-native/icons/x';
import Check from 'lucide-react-native/icons/check';
import Mail from 'lucide-react-native/icons/mail';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { FontFamily, Motion } from '../../config/theme';
import {
  clampNameInput,
  calculateNameLength,
  validateProfileName,
  MAX_PROFILE_NAME_LENGTH,
} from '../../lib/profileUtils';

export interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
  editFirstName: string;
  setEditFirstName: (val: string) => void;
  editLastName: string;
  setEditLastName: (val: string) => void;
  editSaving: boolean;
  onSave: () => void;
  colors: any;
  isDark: boolean;
  styles: any;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  userEmail,
  editFirstName,
  setEditFirstName,
  editLastName,
  setEditLastName,
  editSaving,
  onSave,
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

  const [limitError, setLimitError] = useState<string | null>(null);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLimitError(null);
      setFirstNameError(null);
    }
  }, [visible]);

  const handleFirstNameChange = (val: string) => {
    setFirstNameError(null);
    const res = clampNameInput(val, editLastName, 'first');
    setEditFirstName(res.text);
    if (res.limitReached) {
      setLimitError(`Maximum ${MAX_PROFILE_NAME_LENGTH} characters allowed. Cannot write more.`);
    } else {
      setLimitError(null);
    }
  };

  const handleLastNameChange = (val: string) => {
    const res = clampNameInput(val, editFirstName, 'last');
    setEditLastName(res.text);
    if (res.limitReached) {
      setLimitError(`Maximum ${MAX_PROFILE_NAME_LENGTH} characters allowed. Cannot write more.`);
    } else {
      setLimitError(null);
    }
  };

  const totalLen = calculateNameLength(editFirstName, editLastName);
  const isOverLimit = totalLen > MAX_PROFILE_NAME_LENGTH;
  const isSaveDisabled = editSaving || isOverLimit || !editFirstName.trim();

  const handleSavePress = () => {
    const validation = validateProfileName(editFirstName, editLastName);
    if (!validation.isValid) {
      if (!editFirstName.trim()) {
        setFirstNameError('First name is required.');
      } else {
        setLimitError(validation.error);
      }
      return;
    }
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]} onPress={onClose}>
        <Animated.View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, cardAnimatedStyle]}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>Edit Profile</Text>
          <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>First Name</Text>
          <TextInput
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
                borderColor: firstNameError ? (colors.coral || colors.danger) : colors.border,
                fontFamily: FontFamily.medium,
              },
            ]}
            value={editFirstName}
            onChangeText={handleFirstNameChange}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>Last Name</Text>
          <TextInput
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
                borderColor: colors.border,
                fontFamily: FontFamily.medium,
              },
            ]}
            value={editLastName}
            onChangeText={handleLastNameChange}
            placeholder="Last name (optional)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          {/* Feedback & Character Count Row */}
          <Animated.View
            layout={reduceMotion ? undefined : LinearTransition.duration(180)}
            style={styles.modalCounterRow}
          >
            {limitError ? (
              <Animated.Text
                entering={reduceMotion ? undefined : FadeIn.duration(160)}
                exiting={reduceMotion ? undefined : FadeOut.duration(120)}
                style={[styles.modalErrorText, { color: colors.coral || colors.danger, fontFamily: FontFamily.medium }]}
              >
                {limitError}
              </Animated.Text>
            ) : firstNameError ? (
              <Animated.Text
                entering={reduceMotion ? undefined : FadeIn.duration(160)}
                exiting={reduceMotion ? undefined : FadeOut.duration(120)}
                style={[styles.modalErrorText, { color: colors.coral || colors.danger, fontFamily: FontFamily.medium }]}
              >
                {firstNameError}
              </Animated.Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text
              style={[
                styles.modalCharCount,
                {
                  color: isOverLimit || totalLen === MAX_PROFILE_NAME_LENGTH ? (colors.coral || colors.danger) : colors.textTertiary,
                  fontFamily: FontFamily.medium,
                },
              ]}
            >
              {totalLen}/{MAX_PROFILE_NAME_LENGTH}
            </Text>
          </Animated.View>

          {/* Registered Account Email (Read-Only) */}
          {userEmail ? (
            <View style={styles.modalEmailSection}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                Registered Email
              </Text>
              <View
                style={[
                  styles.modalEmailBox,
                  {
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Mail size={16} color={colors.textTertiary} strokeWidth={2} />
                <Text
                  style={[
                    styles.modalEmailText,
                    {
                      color: colors.textSecondary,
                      fontFamily: FontFamily.medium,
                    },
                  ]}
                  numberOfLines={1}
                  selectable
                >
                  {userEmail}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, { backgroundColor: colors.cardSubtle }]} onPress={onClose}>
              <X size={16} color={colors.textSecondary} />
              <Text style={[styles.modalCancelText, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalBtn,
                { backgroundColor: colors.mintGreen, opacity: isSaveDisabled ? 0.5 : 1 },
              ]}
              onPress={handleSavePress}
              disabled={isSaveDisabled}
            >
              {editSaving ? <ActivityIndicator size="small" color={colors.forestGreen} /> : <Check size={16} color={colors.forestGreen} />}
              <Text style={[styles.modalSaveText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>Save</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};
