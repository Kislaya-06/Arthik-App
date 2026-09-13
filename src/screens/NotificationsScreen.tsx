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
import { formatDistanceToNow, parseISO } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearNotifications = useNotificationStore((s) => s.clearNotifications);

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
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
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
            { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' },
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
              { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' },
            ]}
          >
            No new notifications
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' },
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
            let timeAgo = '';
            try {
              timeAgo = formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true });
            } catch {
              timeAgo = 'Recently';
            }

            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.notifCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: isDark ? 1 : 0,
                  },
                  !n.read && {
                    borderColor: colors.mintGreen,
                    borderWidth: 1,
                  },
                ]}
                activeOpacity={0.75}
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
                          fontFamily: n.read ? 'Quicksand_600SemiBold' : 'Quicksand_700Bold',
                        },
                      ]}
                    >
                      {n.title}
                    </Text>
                    {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.mintGreenDark }]} />}
                  </View>

                  <Text
                    style={[
                      styles.notifMessage,
                      { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' },
                    ]}
                  >
                    {n.message}
                  </Text>

                  <Text
                    style={[
                      styles.notifTime,
                      { color: colors.textMuted, fontFamily: 'Quicksand_500Medium' },
                    ]}
                  >
                    {timeAgo}
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
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    left: 24,
  },
  headerTitle: {
    fontSize: 20,
  },
  headerRightActions: {
    position: 'absolute',
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  notifIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notifContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  notifTime: {
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
