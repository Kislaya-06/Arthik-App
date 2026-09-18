import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle } from 'lucide-react-native';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily } from '../config/theme';

export const SyncFailedBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const failedSyncItems = useExpenseStore((s) => s.failedSyncItems);
  const clearAllFailedSyncItems = useExpenseStore((s) => s.clearAllFailedSyncItems);
  const discardFailedSyncItem = useExpenseStore((s) => s.discardFailedSyncItem);
  const retryFailedSyncItems = useExpenseStore((s) => s.retryFailedSyncItems);

  const isVisible = failedSyncItems.length > 0;
  const [shouldRender, setShouldRender] = useState(isVisible);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  const count = failedSyncItems.length;
  const message = `${count} transaction${count > 1 ? 's' : ''} couldn't be saved — tap to review`;

  const showItemReview = (index: number) => {
    const item = failedSyncItems[index];
    if (!item) return;
    const desc = item.expense?.note || 'Transaction';
    const amt = item.expense?.amount ? ` (₹${item.expense.amount})` : '';
    const hasMore = index + 1 < failedSyncItems.length;

    Alert.alert(
      `Transaction ${index + 1} of ${failedSyncItems.length}`,
      `${desc}${amt}\n\nError: ${item.errorReason}`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Discard Item',
          style: 'destructive',
          onPress: async () => {
            await discardFailedSyncItem(item.id);
          },
        },
        ...(hasMore
          ? [
              {
                text: 'Next',
                onPress: () => showItemReview(index + 1),
              },
            ]
          : []),
      ]
    );
  };

  const handlePress = () => {
    if (count === 1) {
      const item = failedSyncItems[0];
      const desc = item.expense?.note || 'Transaction';
      const amt = item.expense?.amount ? ` (₹${item.expense.amount})` : '';

      Alert.alert(
        'Transaction Not Saved',
        `${desc}${amt}\n\nReason: ${item.errorReason}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await discardFailedSyncItem(item.id);
            },
          },
          {
            text: 'Retry Sync',
            onPress: async () => {
              await retryFailedSyncItems();
            },
          },
        ]
      );
      return;
    }

    const summaryList = failedSyncItems
      .slice(0, 3)
      .map((item, idx) => {
        const desc = item.expense?.note || 'Transaction';
        const amt = item.expense?.amount ? ` (₹${item.expense.amount})` : '';
        return `${idx + 1}. ${desc}${amt}: ${item.errorReason}`;
      })
      .join('\n\n');

    const extra = count > 3 ? `\n\n...and ${count - 3} more` : '';

    Alert.alert(
      'Transactions Not Saved',
      `These transactions could not be saved to your account:\n\n${summaryList}${extra}`,
      [
        {
          text: 'Review & Discard One',
          onPress: () => showItemReview(0),
        },
        {
          text: 'Discard All',
          style: 'destructive',
          onPress: async () => {
            await clearAllFailedSyncItems();
          },
        },
        {
          text: 'Retry All',
          onPress: async () => {
            await retryFailedSyncItems();
          },
        },
      ]
    );
  };

  const bgColor = isDark ? '#3B1219' : '#FEF2F2';
  const borderColor = isDark ? '#7F1D1D' : '#FCA5A5';
  const textColor = isDark ? '#FCA5A5' : '#991B1B';

  return (
    <Animated.View
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[
        styles.wrapper,
        {
          top: Math.max(insets.top, 12) + 6,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={[
          styles.container,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
      >
        <AlertCircle size={15} color={textColor} />
        <Text
          numberOfLines={1}
          style={[
            styles.text,
            { color: textColor, fontFamily: FontFamily.semibold },
          ]}
        >
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: Spacing.block,
    right: Spacing.block,
    zIndex: 9998,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    paddingHorizontal: Spacing.block,
    paddingVertical: 10,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  text: {
    fontSize: 12.5,
    flexShrink: 1,
  },
});
