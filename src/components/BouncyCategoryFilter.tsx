import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily, FontSize } from '../config/theme';

const PILL_PADDING = 4; // inset between outer pill edge and sliding highlight
const TOGGLE_HEIGHT = 48;

export interface FilterOption {
  id: string | null;
  name: string;
}

interface Props {
  options: FilterOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export const BouncyCategoryFilter: React.FC<Props> = ({ options, value, onChange }) => {
  const { colors, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Content-space x + width for each option, keyed by id ?? 'all'
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  // Animated sliding pill position & size (layout-thread, not native, because width can't use ND)
  const pillLeft = useRef(new Animated.Value(PILL_PADDING)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;

  // Per-item press-scale (native driver OK)
  const scales = useRef<Record<string, Animated.Value>>({}).current;
  options.forEach((o) => {
    const k = o.id ?? 'all';
    if (!scales[k]) scales[k] = new Animated.Value(1);
  });

  // Track whether we've done the first no-animation snap
  const initialized = useRef(false);
  const prevKey = useRef<string | null>(null);

  const activeKey = value ?? 'all';
  const activeLayout = layouts[activeKey];

  if (activeLayout) {
    if (!initialized.current) {
      // First layout measurement — snap immediately, no animation
      initialized.current = true;
      prevKey.current = activeKey;
      pillLeft.setValue(activeLayout.x);
      pillWidth.setValue(activeLayout.width);
    } else if (prevKey.current !== activeKey) {
      prevKey.current = activeKey;
      Animated.parallel([
        Animated.spring(pillLeft, {
          toValue: activeLayout.x,
          tension: 70,
          friction: 8,
          useNativeDriver: false,
        }),
        Animated.spring(pillWidth, {
          toValue: activeLayout.width,
          tension: 70,
          friction: 8,
          useNativeDriver: false,
        }),
      ]).start();
      // Auto-scroll so the selected item stays visible
      scrollRef.current?.scrollTo({
        x: Math.max(0, activeLayout.x - 24),
        animated: true,
      });
    }
  }

  return (
    // ── Outer pill: FIXED visual shape, both ends rounded, clips its children ──
    <View
      style={[
        styles.pill,
        {
          backgroundColor: isDark ? colors.card : colors.cardSubtle,
          borderColor: colors.border,
        },
      ]}
    >
      {/* ── ScrollView lives INSIDE the pill ── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        {/* Sliding highlight — absolute in scroll-content space, so it travels with items */}
        <Animated.View
          style={[
            styles.slidingHighlight,
            {
              backgroundColor: colors.mintGreen,
              left: pillLeft,
              width: pillWidth,
            },
          ]}
        />

        {/* Items */}
        {options.map((opt) => {
          const key = opt.id ?? 'all';
          const isActive = value === opt.id;
          const scale = scales[key];

          return (
            <Pressable
              key={key}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setLayouts((prev) => {
                  if (prev[key]?.x === x && prev[key]?.width === width) return prev;
                  return { ...prev, [key]: { x, width } };
                });
              }}
              onPressIn={() =>
                Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
              }
              onPress={() => onChange(opt.id)}
              style={styles.item}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
            >
              <Animated.View style={{ transform: [{ scale }] }}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: isActive
                        ? colors.forestGreen
                        : isDark
                        ? colors.textPrimary
                        : colors.textSecondary,
                      fontFamily: isActive ? FontFamily.bold : FontFamily.semibold,
                    },
                  ]}
                >
                  {opt.name}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    height: TOGGLE_HEIGHT,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    overflow: 'hidden', // clips scroll content at rounded corners → both ends stay rounded
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOGGLE_HEIGHT,
    paddingHorizontal: PILL_PADDING,
  },
  slidingHighlight: {
    position: 'absolute',
    top: PILL_PADDING,
    bottom: PILL_PADDING,
    borderRadius: BorderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  item: {
    height: TOGGLE_HEIGHT,
    paddingHorizontal: Spacing.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: FontSize.bodySmall,
    includeFontPadding: false,
  },
});
