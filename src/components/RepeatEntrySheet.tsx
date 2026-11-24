/**
 * Long-press the + button: your last few spends, one tap to log one again. The Add form opens filled in
 * (today's date) and nothing is saved until Save, so a wrong tap never adds money anywhere.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Repeat from 'lucide-react-native/icons/repeat';
import { BottomSheetModal } from './ui/BottomSheetModal';
import { AppButton } from './ui/AppButton';
import { EmptyState } from './ui/EmptyState';
import { TransactionRow } from './TransactionRow';
import { FontFamily, FontSize, Spacing } from '../config/theme';
import type { Expense } from '../store/expenseStore';
import type { Category } from '../store/categoryStore';
import type { useTheme } from '../store/themeStore';

interface Props {
  visible: boolean;
  entries: Expense[];
  categories: Category[];
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  onPick: (expenseId: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export const RepeatEntrySheet: React.FC<Props> = ({ visible, entries, categories, colors, isDark, onPick, onNew, onClose }) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    title="Add again"
    colors={colors}
    isDark={isDark}
    swipeToDismiss
    footer={<AppButton label="New entry" size="cta" variant="secondary" onPress={onNew} />}
  >
    {entries.length === 0 ? (
      <EmptyState size="section" icon={Repeat} title="Nothing to repeat yet" subtitle="Your recent spends will show here." />
    ) : (
      <View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Tap one to fill in a new entry for today. You can change it before saving.</Text>
        {entries.map((e) => (
          <TransactionRow
            key={e.id}
            expense={e}
            category={categories.find((c) => c.id === e.category_id)}
            isIncome={false}
            colors={colors}
            isDark={isDark}
            onPress={() => onPick(e.id)}
          />
        ))}
      </View>
    )}
  </BottomSheetModal>
);

const styles = StyleSheet.create({
  hint: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium, marginBottom: Spacing.element },
});
