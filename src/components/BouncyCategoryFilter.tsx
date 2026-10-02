import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  Easing,
} from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily, FontSize, ControlHeight } from '../config/theme';

const PILL_PADDING = 4; // inset between outer pill edge and sliding highlight
const TOGGLE_HEIGHT = ControlHeight.standard;

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
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Content-space x + width for each option, keyed by id ?? 'all'
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  // Animated sliding pill position & size (layout-thread, not native, because width can't use ND)
  const pillLeft = useRef(new Animated.Value(PILL_PADDING)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;
  const stretchAnim = useRef(new Animated.Value(1)).current;
  const squishAnim = useRef(new Animated.Value(1)).current;
  const leadAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    const activeLayout = layouts[activeKey];
    if (!activeLayout) return;

    if (!initialized.current) {
      // First layout measurement — snap immediately, no animation
      initialized.current = true;
      prevKey.current = activeKey;
      pillLeft.setValue(activeLayout.x);
      pillWidth.setValue(activeLayout.width);
      stretchAnim.setValue(1);
      squishAnim.setValue(1);
      leadAnim.setValue(0);
      return;
    }

    if (prevKey.current !== activeKey) {
      const prevIdx = options.findIndex((o) => (o.id ?? 'all') === prevKey.current);
      const currIdx = options.findIndex((o) => (o.id ?? 'all') === activeKey);
      const distance = Math.max(1, Math.abs(currIdx - prevIdx));
      const direction = currIdx >= prevIdx ? 1 : -1;
      prevKey.current = activeKey;

      // 1. Primary slide: Apple-calibrated critically damped spring (zero overshoot)
      Animated.parallel([
        Animated.spring(pillLeft, {
          toValue: activeLayout.x,
          tension: 100,
          friction: 16,
          useNativeDriver: false,
        }),
        Animated.spring(pillWidth, {
          toValue: activeLayout.width,
          tension: 100,
          friction: 16,
          useNativeDriver: false,
        }),
      ]).start();

      // 2. Dual-Edge Liquid Morph: leading edge stretch & vertical volume squish
      const maxStretch = Math.min(1.22, 1 + distance * 0.06);
      const minSquish = Math.max(0.90, 1 - distance * 0.03);
      const maxLead = Math.min(12, distance * 3.5) * direction;
      const launchDuration = Math.min(120, 50 + distance * 20);

      stretchAnim.stopAnimation();
      squishAnim.stopAnimation();
      leadAnim.stopAnimation();

      Animated.parallel([
        Animated.sequence([
          Animated.timing(stretchAnim, {
            toValue: maxStretch,
            duration: launchDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.spring(stretchAnim, {
            toValue: 1,
            tension: 140,
            friction: 14,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(squishAnim, {
            toValue: minSquish,
            duration: launchDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.spring(squishAnim, {
            toValue: 1,
            tension: 140,
            friction: 14,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(leadAnim, {
            toValue: maxLead,
            duration: launchDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.spring(leadAnim, {
            toValue: 0,
            tension: 140,
            friction: 14,
            useNativeDriver: false,
          }),
        ]),
      ]).start();

      // Auto-scrolling on click is deliberately removed per user request.
      // The user scrolls manually; the pill glides to the selected item with liquid morph.
    }
  }, [activeKey, layouts, options, pillLeft, pillWidth, stretchAnim, squishAnim, leadAnim]);

  return (
    // ── Outer pill: FIXED visual shape, both ends rounded, clips its children ──
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.cardSubtle,
          borderColor: colors.borderSubtle,
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
              transform: [
                { translateX: leadAnim },
                { scaleX: stretchAnim },
                { scaleY: squishAnim },
              ],
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
                        : colors.textSecondary,
                      fontFamily: isActive ? FontFamily.bold : FontFamily.medium,
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
