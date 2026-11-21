import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';
import BellOff from 'lucide-react-native/icons/bell-off';
import Sparkles from 'lucide-react-native/icons/sparkles';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import Coins from 'lucide-react-native/icons/coins';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Bell from 'lucide-react-native/icons/bell';
import Zap from 'lucide-react-native/icons/zap';
import Trash2 from 'lucide-react-native/icons/trash';
import CheckCheck from 'lucide-react-native/icons/check-check';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing as REasing,
} from 'react-native-reanimated';
import { useTheme } from '../store/themeStore';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useNotificationStore, AppNotification } from '../store/notificationStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Spacing, FontSize, FontFamily, LineHeight, Motion, BorderRadius, LetterSpacing } from '../config/theme';
import { groupNotificationsByDate } from '../lib/notificationGroups';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const NotificationsEmptyState: React.FC<{
  reduceMotion: boolean;
}> = React.memo(({ reduceMotion }) => {
  const anim = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      anim.value = 1;
      return;
    }
    anim.value = 0;
    anim.value = withTiming(1, {
      duration: Motion.duration.snappy,
      easing: REasing.bezier(0.23, 1, 0.32, 1),
    });
  }, [reduceMotion, anim]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.96, 1]) }],
  }));

  return (
    <Animated.View style={[styles.emptyContainer, animatedStyle]}>
      <EmptyState
        icon={BellOff}
        title="No new notifications"
        subtitle="Budget updates, balance alerts, and savings celebrations will appear here."
      />
    </Animated.View>
  );
});

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();

  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearNotifications = useNotificationStore((s) => s.clearNotifications);
  // Sections like the Ledger: TODAY / YESTERDAY / THIS WEEK / THIS MONTH / month names, each in one card.
  const groups = React.useMemo(() => groupNotificationsByDate(notifications, new Date()), [notifications]);

  const getCompactTime = (isoString: string): string => {
    try {
      const date = parseISO(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay < 7) return `${diffDay}d ago`;
      return format(date, 'd MMM');
    } catch {
      return 'Recently';
    }
  };

  const getIcon = (type: AppNotification['type'], iconColor = '#1A2B4C') => {
    switch (type) {
      case 'budget_exceeded':
        return <AlertCircle size={20} color={iconColor} strokeWidth={2.2} />;
      case 'budget_warning':
        return <AlertTriangle size={20} color={iconColor} strokeWidth={2.2} />;
      case 'savings_rollover':
      case 'gullak_reward':
        return <Sparkles size={20} color={iconColor} strokeWidth={2.2} />;
      case 'weekly_recap':
      case 'monthly_recap':
        return <CalendarDays size={20} color={iconColor} strokeWidth={2.2} />;
      case 'daily_reminder':
      case 'pure_deficit_balanced':
        return <Coins size={20} color={iconColor} strokeWidth={2.2} />;
      case 'autolog_digest':
        return <Zap size={20} color={iconColor} strokeWidth={2.2} />;
      default:
        return <Bell size={20} color={iconColor} strokeWidth={2.2} />;
    }
  };

  const getIconBg = (type: AppNotification['type']) => {
    switch (type) {
      case 'budget_exceeded':
        return '#FF857A';
      case 'budget_warning':
        return '#F4A460';
      case 'savings_rollover':
      case 'gullak_reward':
        return '#ADEBB3';
      case 'weekly_recap':
      case 'monthly_recap':
      case 'pure_deficit_balanced':
      case 'autolog_digest':
        return '#B8D4F4';
      case 'daily_reminder':
        return '#EBAEE6';
      default:
        return '#FFD3AC';
    }
  };

  const handleNotificationPress = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.type === 'weekly_recap' || notif.type === 'monthly_recap') {
      navigation.navigate('AppTabs', { screen: 'Insights' });
      return;
    }
    if (notif.type === 'autolog_digest') {
      navigation.navigate('AutoLogCenter');
      return;
    }
    if (
      notif.type === 'budget_warning' ||
      notif.type === 'budget_exceeded' ||
      notif.type === 'savings_rollover' ||
      notif.type === 'gullak_reward' ||
      notif.type === 'daily_reminder' ||
      notif.data?.screen === 'Savings'
    ) {
      const isBudgetModeEnabled = useDailyBudgetStore.getState().isBudgetModeEnabled;
      if (!isBudgetModeEnabled || notif.type === 'daily_reminder') {
        navigation.navigate('AppTabs', { screen: 'Home' });
      } else {
        navigation.navigate('Savings' as any);
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacing.block,
          backgroundColor: colors.background,
        },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <ScreenHeader
        title="Notifications"
        right={notifications.length > 0 ? (
          <>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY} accessibilityRole="button" accessibilityLabel="Mark all as read" onPress={markAllAsRead} hitSlop={12}>
              <CheckCheck size={20} color={colors.textSecondary} />
            </PressableOpacity>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY} accessibilityRole="button" accessibilityLabel="Clear all notifications" onPress={clearNotifications} hitSlop={12}>
              <Trash2 size={20} color={colors.textSecondary} />
            </PressableOpacity>
          </>
        ) : null}
      />

      {/* Content */}
      {notifications.length === 0 ? (
        <NotificationsEmptyState reduceMotion={reduceMotion} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.textSecondary }]} accessibilityRole="header">
                {group.label}
              </Text>
              <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                {group.items.map((n, index) => {
                  const timeAgo = getCompactTime(n.createdAt);

                  return (
                    <PressableOpacity
                      key={n.id}
                      style={[
                        styles.notifRow,
                        {
                          borderBottomWidth: index === group.items.length - 1 ? 0 : StyleSheet.hairlineWidth,
                          borderBottomColor: colors.borderSubtle,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleNotificationPress(n)}
                    >
                      <GradientIconBadge size={44} color={getIconBg(n.type)} isDark={isDark}>
                        {({ iconColor }) => getIcon(n.type, iconColor)}
                      </GradientIconBadge>

                      <View style={styles.notifContent}>
                        <View style={styles.notifTitleRow}>
                          <Text
                            style={[
                              styles.notifTitle,
                              {
                                color: colors.textPrimary,
                                fontFamily: n.read ? FontFamily.semibold : FontFamily.bold,
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {n.title}
                          </Text>
                          <View style={styles.notifRightMeta}>
                            <Text style={[styles.notifTime, { color: colors.textMuted }]}>
                              {timeAgo}
                            </Text>
                            {!n.read && (
                              <View
                                style={[
                                  styles.unreadDot,
                                  { backgroundColor: isDark ? colors.mintGreen : colors.mintGreenDark },
                                ]}
                              />
                            )}
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.notifMessage,
                            { color: colors.textSecondary, fontFamily: FontFamily.medium },
                          ]}
                        >
                          {n.message}
                        </Text>
                      </View>
                    </PressableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.element,
    paddingBottom: 30,
    gap: Spacing.block,
  },
  group: {
    gap: Spacing.element,
  },
  groupLabel: {
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.label,
    fontFamily: FontFamily.bold,
    paddingHorizontal: Spacing.micro,
  },
  groupCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.row,
    paddingHorizontal: Spacing.block,
  },
  notifIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notifContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  notifTitle: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 10,
  },
  notifRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
  },
  notifTime: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    paddingBottom: 40,
  },
});
