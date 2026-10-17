import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { X, Check, Mail } from 'lucide-react-native';
import { FontFamily } from '../../config/theme';
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
        <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
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
          <View style={styles.modalCounterRow}>
            {limitError ? (
              <Text style={[styles.modalErrorText, { color: colors.coral || colors.danger, fontFamily: FontFamily.medium }]}>
                {limitError}
              </Text>
            ) : firstNameError ? (
              <Text style={[styles.modalErrorText, { color: colors.coral || colors.danger, fontFamily: FontFamily.medium }]}>
                {firstNameError}
              </Text>
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
          </View>

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
        </Pressable>
      </Pressable>
    </Modal>
  );
};
