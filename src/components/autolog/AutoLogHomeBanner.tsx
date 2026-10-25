import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Inbox from 'lucide-react-native/icons/inbox';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useTheme } from '../../store/themeStore';
import { useAutoLogStore } from '../../features/autoLog/store';
import { navigateTo } from '../../navigation/navigationRef';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { Spacing, FontSize, FontFamily, BorderRadius, Motion } from '../../config/theme';

/** Compact strip on Home. Renders nothing unless there is something to act on. */
export const AutoLogHomeBanner: React.FC = () => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const mode = useAutoLogStore((s) => s.mode);
  const pending = useAutoLogStore((s) => s.pendingCount);
  const attention = useAutoLogStore((s) => s.attention);

  if (mode !== 'live' || (!pending && !attention)) return null;

  const isReview = pending > 0;
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(Motion.duration.snappy)}
      exiting={reduceMotion ? undefined : FadeOut.duration(Motion.duration.snappy)}
      layout={reduceMotion ? undefined : LinearTransition.duration(Motion.duration.standard)}
    >
      <Pressable
        onPress={() => navigateTo(isReview ? 'AutoLogReview' : 'AutoLogCenter')}
        style={[styles.wrap, { backgroundColor: isReview ? colors.peachSoft : colors.cardSubtle, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}
      >
        {isReview ? <Inbox size={16} color={colors.peachCoral} /> : <AlertTriangle size={16} color="#F59E0B" />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.text, { color: colors.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {isReview ? `${pending} transaction${pending === 1 ? '' : 's'} need${pending === 1 ? 's' : ''} your review` : 'Auto-Logging needs attention'}
          </Text>
        </View>
        <Text style={[styles.cta, { color: isReview ? colors.peachCoral : colors.textSecondary }]}>{isReview ? 'Review' : 'Fix'}</Text>
        <ChevronRight size={16} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.block, paddingVertical: 10, marginTop: Spacing.group },
  text: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  cta: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
});
