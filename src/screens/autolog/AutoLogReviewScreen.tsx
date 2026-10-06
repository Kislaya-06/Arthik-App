import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Inbox } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, BorderRadius } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { Body, Card, ScreenHeader } from '../../components/autolog/AutoLogUi';
import { ReviewSheet } from '../../components/autolog/ReviewSheet';
import * as db from '../../features/autoLog/db';
import { ignoreEvent } from '../../features/autoLog/reviews';
import { useAutoLogStore } from '../../features/autoLog/store';
import { accountLabelFromKey, dateTime, directionWord, eventTitle, money, reviewLabelFor } from '../../features/autoLog/copy';
import type { AutoLogEvent } from '../../features/autoLog/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogReview'>;

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

  const renderItem = ({ item }: { item: AutoLogEvent }) => {
    const acc = accountLabelFromKey(item.accountKey, accounts);
    const unrecognized = item.reviewReason === 'unrecognized';
    return (
      <Card>
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
              <AppButton label="Ignore this type" variant="outline" size="compact" style={{ flex: 1 }} onPress={async () => { await ignoreEvent(item, 'similar'); flash('Similar messages will be ignored'); load(); }} />
              <AppButton label="Review" size="compact" style={{ flex: 1 }} onPress={() => setActive(item)} />
            </View>
          </>
        ) : (
          <AppButton label="Review" size="compact" style={{ marginTop: Spacing.group }} onPress={() => setActive(item)} />
        )}
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title={`Pending Review${items.length ? ` · ${items.length}` : ''}`} onBack={() => navigation.goBack()} />
      {toast ? <Text style={[styles.toast, { color: colors.mintGreenDark }]}>{toast}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
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
});
