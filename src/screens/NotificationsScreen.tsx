import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  BellOff,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Coins,
  Bell,
  Trash2,
  CheckCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';
import { useNotificationStore, AppNotification } from '../store/notificationStore';
import { format, parseISO } from 'date-fns';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearNotifications = useNotificationStore((s) => s.clearNotifications);

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

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'budget_exceeded':
        return <AlertCircle size={20} color="#DC2626" />;
      case 'budget_warning':
        return <AlertTriangle size={20} color="#D97706" />;
      case 'savings_rollover':
        return <Sparkles size={20} color={colors.mintGreenDark} />;
      case 'daily_reminder':
        return <Coins size={20} color={colors.mintGreenDark} />;
      default:
        return <Bell size={20} color={colors.textPrimary} />;
    }
  };

  const getIconBg = (type: AppNotification['type']) => {
    switch (type) {
      case 'budget_exceeded':
        return isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2';
      case 'budget_warning':
        return isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7';
      case 'savings_rollover':
        return colors.mintGreenSoft;
      case 'daily_reminder':
        return colors.mintGreenSoft;
      default:
        return colors.cardSubtle;
    }
  };

  const handleNotificationPress = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (
      notif.type === 'budget_warning' ||
      notif.type === 'budget_exceeded' ||
      notif.type === 'savings_rollover' ||
      notif.type === 'daily_reminder'
    ) {
      navigation.navigate('Savings' as any);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.block,
          paddingBottom: insets.bottom + Spacing.block,
          backgroundColor: colors.background,
        },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary, fontFamily: FontFamily.bold },
          ]}
        >
          Notifications
        </Text>

        {notifications.length > 0 && (
          <View style={styles.headerRightActions}>
            <TouchableOpacity onPress={markAllAsRead} hitSlop={10} style={styles.actionBtn}>
              <CheckCheck size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearNotifications} hitSlop={10} style={styles.actionBtn}>
              <Trash2 size={19} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.cardSubtle }]}>
            <BellOff size={32} color={colors.textSecondary} />
          </View>
          <Text
            style={[
              styles.emptyTitle,
              { color: colors.textPrimary, fontFamily: FontFamily.bold },
            ]}
          >
            No new notifications
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: colors.textSecondary, fontFamily: FontFamily.medium },
            ]}
          >
            Daily budget updates, remaining balance alerts, and savings rollover celebrations will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((n) => {
            const timeAgo = getCompactTime(n.createdAt);

            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.notifRow,
                  {
                    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.borderSubtle,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(n)}
              >
                <View style={[styles.notifIconWrap, { backgroundColor: getIconBg(n.type) }]}>
                  {getIcon(n.type)}
                </View>

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
                      numberOfLines={1}
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: Spacing.gutter,
    marginBottom: Spacing.surface,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.gutter,
  },
  headerTitle: {
    fontSize: FontSize.sectionTitle,
  },
  headerRightActions: {
    position: 'absolute',
    right: Spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionBtn: {
    padding: Spacing.micro,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingBottom: 30,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    justifyContent: 'center',
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  notifTitle: {
    fontSize: 16,
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
    fontSize: 13,
    lineHeight: 18,
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
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.gutter,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: Spacing.element,
  },
  emptySubtitle: {
    fontSize: FontSize.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
  },
});
