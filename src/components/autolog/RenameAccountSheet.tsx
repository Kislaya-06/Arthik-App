import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight } from '../../config/theme';
import type { TrackedAccount } from '../../features/autoLog/types';

/** Gives a tracked account the user's own name ("Salary account"). Blank removes the name. */
export const RenameAccountSheet: React.FC<{
  account: TrackedAccount | null;
  maxLength: number;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}> = ({ account, maxLength, onClose, onSave }) => {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account) setName(account.nickname ?? '');
  }, [account]);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheetModal
      visible={!!account}
      onClose={onClose}
      title="Name this account"
      colors={colors}
      isDark={isDark}
      avoidKeyboard
      footer={<AppButton label="Save" size="cta" loading={busy} onPress={save} />}
    >
      <View style={styles.wrap}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          {account ? `${account.bank} ••••${account.last4}. ` : ''}A name helps you spot it quickly. It stays on this phone.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={maxLength}
          placeholder="e.g. Salary account"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel="Account name"
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: FontFamily.medium }]}
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Leave it empty to show the bank name again.</Text>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.element, paddingBottom: Spacing.element },
  intro: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall, fontFamily: FontFamily.medium },
  input: { height: ControlHeight.standard, borderRadius: BorderRadius.input, paddingHorizontal: Spacing.block, fontSize: FontSize.body },
  hint: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
});
