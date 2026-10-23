import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  LinearTransition,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Inbox from 'lucide-react-native/icons/inbox';
import Trash2 from 'lucide-react-native/icons/trash';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, BorderRadius } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { Body, Card, ScreenHeader } from '../../components/autolog/AutoLogUi';
import { ReviewSheet } from '../../components/autolog/ReviewSheet';
import * as db from '../../features/autoLog/db';
import * as service from '../../features/autoLog/service';
import { ignoreEvent, discardEvent } from '../../features/autoLog/reviews';
import { useAutoLogStore } from '../../features/autoLog/store';
import { accountLabelFromKey, dateTime, directionWord, eventTitle, money, reviewLabelFor } from '../../features/autoLog/copy';
import type { AutoLogEvent, TrackedAccount } from '../../features/autoLog/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogReview'>;

const ACTION_WIDTH = 84;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ROW_CLOSE = LinearTransition.duration(250);

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

interface ReviewCardItemProps {
  item: AutoLogEvent;
  accounts: TrackedAccount[];
  onReview: (item: AutoLogEvent) => void;
  onIgnoreSimilar: (item: AutoLogEvent) => void;
  onDelete: (item: AutoLogEvent) => void;
}

const ReviewCardItem = React.memo<ReviewCardItemProps>(({
  item,
  accounts,
  onReview,
  onIgnoreSimilar,
  onDelete,
}) => {
  const { colors, isDark } = useTheme();
  const [swipedOpen, setSwipedOpen] = useState(false);
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-8, 8])
        .onStart(() => {
          'worklet';
          contextX.set(translateX.get());
        })
        .onUpdate((e) => {
          'worklet';
          const next = contextX.get() + e.translationX;
          if (next > 0) {
            translateX.set(rubberband(next, ACTION_WIDTH));
          } else if (next < -ACTION_WIDTH) {
            const overshoot = next + ACTION_WIDTH;
            translateX.set(-ACTION_WIDTH + rubberband(overshoot, ACTION_WIDTH));
          } else {
            translateX.set(next);
          }
        })
        .onEnd((e) => {
          'worklet';
          const projected = translateX.get() + project(e.velocityX);
          if (projected < -ACTION_WIDTH * 0.45) {
            translateX.set(withSpring(-ACTION_WIDTH, { duration: 300, dampingRatio: 0.8, velocity: e.velocityX }));
            scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
            scheduleOnRN(setSwipedOpen, true);
          } else {
            translateX.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityX }));
            scheduleOnRN(setSwipedOpen, false);
          }
        }),
    []
  );

  const closeSwipe = () => {
    translateX.set(withSpring(0, { duration: 300, dampingRatio: 0.8 }));
    setSwipedOpen(false);
  };

  const handleCardDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    translateX.set(
      withTiming(-450, { duration: 200, easing: EASE_OUT }, (finished) => {
        if (finished) {
          scheduleOnRN(onDelete, item);
        }
      })
    );
  };

  const handleReviewPress = () => {
    if (Math.abs(translateX.get()) > 10) {
      closeSwipe();
      return;
    }
    onReview(item);
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const acc = accountLabelFromKey(item.accountKey, accounts);
  const unrecognized = item.reviewReason === 'unrecognized';

  return (
    <View style={styles.rowWrapper}>
      {/* Background action button revealed upon left swipe */}
      <View style={styles.actionUnderlay}>
        <Pressable
          onPress={handleCardDelete}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteBtn,
            {
              backgroundColor: colors.peachSoft,
              borderColor: isDark ? colors.border : 'transparent',
              borderWidth: isDark ? 1 : 0,
            },
            pressed && { opacity: 0.75 },
          ]}
          accessibilityLabel="Delete review"
        >
          <Trash2 size={20} color={colors.peachCoral} strokeWidth={2.2} />
          <Text style={[styles.deleteBtnText, { color: colors.peachCoral }]}>Delete</Text>
        </Pressable>
      </View>

      {/* Swipeable foreground card */}
      <GestureDetector gesture={pan}>
        <Animated.View style={animatedCardStyle}>
          <Card style={{ marginBottom: 0 }}>
            <View style={styles.rowTop}>
              <Text style={[styles.amount, { color: colors.textPrimary }]}>{money(item.amount)}</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}> — {eventTitle(item)}</Text>
            </View>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {[directionWord(item), acc, dateTime(item.occurredAt)].filter(Boolean).join(' — ')}
            </Text>
            <View style={[styles.chip, { backgroundColor: colors.peachSoft }]}>
              <Text style={[styles.chipText, { color: colors.peachCoral }]}>{reviewLabelFor(item)}</Text>
            </View>
            {unrecognized ? (
              <>
                <Body muted style={{ marginTop: Spacing.element }}>
                  Arthik found a message that looks like a transaction but couldn't understand it safely.
                </Body>
                <View style={styles.row2}>
                  <AppButton
                    label="Ignore this type"
                    variant="outline"
                    size="compact"
                    style={{ flex: 1 }}
                    onPress={() => onIgnoreSimilar(item)}
                  />
                  <AppButton
                    label="Review"
                    size="compact"
                    style={{ flex: 1 }}
                    onPress={handleReviewPress}
                  />
                </View>
              </>
            ) : (
              <AppButton
                label="Review"
                size="compact"
                style={{ marginTop: Spacing.group }}
                onPress={handleReviewPress}
              />
            )}
          </Card>
          {swipedOpen && (
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSwipe} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

ReviewCardItem.displayName = 'ReviewCardItem';

/** Pending Review inbox (spec §19). Uncertain events wait here — Arthik never silently guesses. */
export const AutoLogReviewScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const accounts = useAutoLogStore((s) => s.accounts);
  const [items, setItems] = useState<AutoLogEvent[]>([]);
  const [active, setActive] = useState<AutoLogEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      await db.openDb(userId);
      setItems(await db.listPending());
    } catch {
      setItems([]);
    }
    useAutoLogStore.getState().refresh(userId);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const confirmClearAll = useCallback(() => {
    if (!userId || items.length === 0) return;
    Alert.alert(
      'Clear all pending reviews?',
      `This will dismiss all ${items.length} pending review item${items.length === 1 ? '' : 's'}. They will not be logged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await service.clearAllPendingReviews(userId);
              setItems([]);
              flash('All pending reviews cleared');
              await useAutoLogStore.getState().refresh(userId);
            } catch (e: any) {
              flash(e?.message || 'Failed to clear reviews');
            }
          },
        },
      ]
    );
  }, [userId, items.length]);

  const handleDeleteItem = useCallback(
    async (item: AutoLogEvent) => {
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      try {
        await discardEvent(item);
        flash('Review discarded');
        if (userId) {
          await useAutoLogStore.getState().refresh(userId);
        }
      } catch (e: any) {
        flash(e?.message || 'Failed to discard');
        load();
      }
    },
    [userId, load]
  );

  const handleIgnoreSimilar = useCallback(
    async (item: AutoLogEvent) => {
      await ignoreEvent(item, 'similar');
      flash('Similar messages will be ignored');
      load();
    },
    [load]
  );

  const renderItem = useCallback(
    ({ item }: { item: AutoLogEvent }) => (
      <ReviewCardItem
        item={item}
        accounts={accounts}
        onReview={(ev) => setActive(ev)}
        onIgnoreSimilar={handleIgnoreSimilar}
        onDelete={handleDeleteItem}
      />
    ),
    [accounts, handleIgnoreSimilar, handleDeleteItem]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader
        title={`Pending Review${items.length ? ` · ${items.length}` : ''}`}
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <Pressable
              onPress={confirmClearAll}
              hitSlop={10}
              style={({ pressed }) => [styles.headerClearBtn, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Clear all pending reviews"
            >
              <Trash2 size={20} color={colors.peachCoral} strokeWidth={2.2} />
            </Pressable>
          ) : null
        }
      />
      {toast ? <Text style={[styles.toast, { color: colors.mintGreenDark }]}>{toast}</Text> : null}
      <Animated.FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        itemLayoutAnimation={ROW_CLOSE}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.section }]}
        ListHeaderComponent={
          items.length ? (
            <Body muted style={{ marginBottom: Spacing.group }}>
              The more accurately you accept, correct, or reject detections, the better Automatic Logging becomes.
            </Body>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Inbox size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All caught up</Text>
            <Body muted style={{ textAlign: 'center' }}>Nothing needs your review right now.</Body>
          </View>
        }
      />
      <ReviewSheet
        visible={!!active}
        event={active}
        accounts={accounts}
        onClose={() => setActive(null)}
        onDone={(m) => {
          setActive(null);
          flash(m);
          load();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: Spacing.gutter },
  rowWrapper: {
    marginBottom: Spacing.group,
    position: 'relative',
    justifyContent: 'center',
  },
  actionUnderlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.nano,
  },
  deleteBtnText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.4,
  },
  rowTop: { flexDirection: 'row', alignItems: 'baseline' },
  amount: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold },
  title: { flex: 1, fontSize: FontSize.body, fontFamily: FontFamily.semibold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: Spacing.micro },
  chip: { alignSelf: 'flex-start', borderRadius: BorderRadius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: Spacing.element },
  chipText: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  row2: { flexDirection: 'row', gap: Spacing.group, marginTop: Spacing.group },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.element },
  emptyTitle: { fontSize: FontSize.titleMedium, fontFamily: FontFamily.bold },
  toast: { textAlign: 'center', fontSize: FontSize.caption, fontFamily: FontFamily.bold, marginBottom: Spacing.element },
  headerClearBtn: { padding: Spacing.element },
});
