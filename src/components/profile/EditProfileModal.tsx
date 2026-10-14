import React from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { FontFamily } from '../../config/theme';

export interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]} onPress={onClose}>
        <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>Edit Profile</Text>
          <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>First Name</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, fontFamily: FontFamily.medium }]}
            value={editFirstName}
            onChangeText={setEditFirstName}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>Last Name</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, fontFamily: FontFamily.medium }]}
            value={editLastName}
            onChangeText={setEditLastName}
            placeholder="Last name (optional)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, { backgroundColor: colors.cardSubtle }]} onPress={onClose}>
              <X size={16} color={colors.textSecondary} />
              <Text style={[styles.modalCancelText, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: colors.mintGreen }]} onPress={onSave} disabled={editSaving}>
              {editSaving ? <ActivityIndicator size="small" color={colors.forestGreen} /> : <Check size={16} color={colors.forestGreen} />}
              <Text style={[styles.modalSaveText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
