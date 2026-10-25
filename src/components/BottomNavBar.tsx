import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  useAnimatedValue,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Easing as REasing,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import Home from 'lucide-react-native/icons/house';
import Clock from 'lucide-react-native/icons/clock';
import BarChart2 from 'lucide-react-native/icons/chart-no-axes-column';
import Plus from 'lucide-react-native/icons/plus';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { useNavBarStore } from '../store/navBarStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { FontFamily, Motion } from '../config/theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useNavBarMetrics } from '../hooks/useNavBarMetrics';
import { NAV_LABEL_MAX_FONT_SCALE } from '../lib/navBarLayout';
import * as Haptics from 'expo-haptics';

// ─── Dual-Layer Cross-Fading Icon ───────────────────────────────────────────
const AnimatedIcon = ({
  icon: Icon,
  progress,
}: {
  icon: any;
  progress: SharedValue<number>;
}) => {
  const { colors } = useTheme();

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={styles.iconWrapper}>
      {/* Inactive Icon layer */}
      <View style={styles.iconLayer}>
        <Icon size={20} color={colors.textSecondary} />
      </View>
      {/* Active Icon layer (Mint Green) */}
      <Reanimated.View style={[styles.iconLayer, activeIconStyle]}>
        <Icon size={20} color={colors.mintGreen} />
      </Reanimated.View>
    </View>
  );
};

// ─── Expanding Active Capsule Tab Item ──────────────────────────────────────
const ReanimatedPressable = Reanimated.createAnimatedComponent(Pressable);

interface CapsuleTabItemProps {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
  /** Room for the label when active (responsive; 50 on normal phones). */
  labelMax: number;
  /** Width of the icon-only slot (44 on normal phones). */
  minWidth: number;
  /** Optional animated right margin when active to balance wing padding (Insights). */
  activeMarginRight?: number;
}

const CapsuleTabItem = React.memo<CapsuleTabItemProps>(({
  icon,
  label,
  active,
  onPress,
  labelMax,
  minWidth,
  activeMarginRight,
}) => {
  const { isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(active ? 1 : 0);
  const pressScale = useAnimatedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = active ? 1 : 0;
      return;
    }
    progress.value = withTiming(active ? 1 : 0, {
      duration: 180,
      easing: REasing.out(REasing.cubic),
    });
  }, [active, progress, reduceMotion]);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: Motion.scale.press,
      tension: Motion.springs.press.tension,
      friction: Motion.springs.press.friction,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 1,
      tension: Motion.springs.release.tension,
      friction: Motion.springs.release.friction,
      useNativeDriver: true,
    }).start();
  };

  const activeBg = isDark ? 'rgba(184, 224, 200, 0.16)' : 'rgba(184, 224, 200, 0.22)';
  const activeBorder = isDark ? 'rgba(184, 224, 200, 0.3)' : 'rgba(184, 224, 200, 0.35)';

  const capsuleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(184, 224, 200, 0)', activeBg]),
    borderColor: interpolateColor(progress.value, [0, 1], ['rgba(184, 224, 200, 0)', activeBorder]),
    paddingHorizontal: interpolate(progress.value, [0, 1], [7, 11], Extrapolation.CLAMP),
  }), [activeBg, activeBorder]);

  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(progress.value, [0, 1], [0, labelMax], Extrapolation.CLAMP),
    opacity: interpolate(progress.value, [0, 0.35, 1], [0, 0, 1], Extrapolation.CLAMP),
    marginLeft: interpolate(progress.value, [0, 1], [0, 5], Extrapolation.CLAMP),
  }), [labelMax]);

  const wrapperStyle = useAnimatedStyle(() =>
    activeMarginRight
      ? { marginRight: interpolate(progress.value, [0, 1], [0, activeMarginRight], Extrapolation.CLAMP) }
      : {}
  , [activeMarginRight]);

  return (
    <ReanimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      unstable_pressDelay={0}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 16, right: 16 }}
      style={[
        styles.tabPressable,
        { minWidth },
        wrapperStyle,
      ]}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Reanimated.View
          style={[
            styles.capsule,
            capsuleStyle,
          ]}
        >
          <AnimatedIcon icon={icon} progress={progress} />

          <Reanimated.View
            style={[
              {
                overflow: 'hidden',
                justifyContent: 'center',
                height: 22,
              },
              labelStyle,
            ]}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={NAV_LABEL_MAX_FONT_SCALE}
              style={[
                styles.tabLabel,
                { color: '#FFFFFF' },
              ]}
            >
              {label}
            </Text>
          </Reanimated.View>
        </Reanimated.View>
      </Animated.View>
    </ReanimatedPressable>
  );
});

// ─── Center Flush Action Button (+) ──────────────────────────────────────────
const CenterAddButton = React.memo<{ onPress: () => void }>(({ onPress }) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useAnimatedValue(1);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: Motion.scale.press,
      tension: Motion.springs.press.tension,
      friction: Motion.springs.press.friction,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      tension: Motion.springs.release.tension,
      friction: Motion.springs.release.friction,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      unstable_pressDelay={0}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 16, right: 16 }}
      style={styles.addButtonWrapper}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View
        style={[
          styles.addButton,
          {
            backgroundColor: colors.mintGreen,
            shadowColor: colors.mintGreen,
            transform: [{ scale }],
          },
        ]}
      >
        <Plus size={22} color={colors.forestGreen} strokeWidth={2.8} />
      </Animated.View>
    </Pressable>
  );
});

// ─── Individual Floating Action Button (+) for Pure Mode ─────────────────────
const IndividualAddButton = React.memo<{ onPress: () => void }>(({ onPress }) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useAnimatedValue(1);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: Motion.scale.press,
      tension: Motion.springs.press.tension,
      friction: Motion.springs.press.friction,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      tension: Motion.springs.release.tension,
      friction: Motion.springs.release.friction,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      unstable_pressDelay={0}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 16, right: 16 }}
      style={styles.individualFabWrapper}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View
        style={[
          styles.individualFab,
          {
            backgroundColor: colors.mintGreen,
            shadowColor: colors.mintGreen,
            transform: [{ scale }],
          },
        ]}
      >
        <Plus size={22} color={colors.forestGreen} strokeWidth={2.8} />
      </Animated.View>
    </Pressable>
  );
});

// ─── Main Bottom Navigation Bar Component ───────────────────────────────────
export const BottomNavBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { colors, isDark } = useTheme();
  const isVisible = useNavBarStore((s) => s.isVisible);
  // Responsive spacing for this phone (bottom gap above system navigation, margins, label room).
  const m = useNavBarMetrics();
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const translateY = useAnimatedValue(0);
  const modeAnim = useAnimatedValue(isBudgetModeEnabled ? 1 : 0);

  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      modeAnim.setValue(isBudgetModeEnabled ? 1 : 0);
      return;
    }
    Animated.timing(modeAnim, {
      toValue: isBudgetModeEnabled ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isBudgetModeEnabled, modeAnim, reduceMotion]);

  const bottomOffset = m.bottomGap;

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(isVisible ? 0 : 160 + m.bottomGap);
      return;
    }
    Animated.spring(translateY, {
      toValue: isVisible ? 0 : 160 + m.bottomGap,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [isVisible, translateY, m.bottomGap, reduceMotion]);

  const opacity = translateY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const getRouteIndex = useCallback(
    (name: string) => stateRef.current.routes.findIndex((r) => r.name === name),
    []
  );

  const navigateTo = useCallback(
    (routeName: string, routeIndex: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const currentState = stateRef.current;
      const event = navigation.emit({
        type: 'tabPress',
        target: currentState.routes[routeIndex]?.key || '',
        canPreventDefault: true,
      });

      if (currentState.index !== routeIndex && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation]
  );

  const handleAddExpense = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate('AddExpense');
  }, [navigation]);

  const onPressHome = useCallback(() => navigateTo('Home', getRouteIndex('Home')), [navigateTo, getRouteIndex]);
  const onPressHistory = useCallback(() => navigateTo('History', getRouteIndex('History')), [navigateTo, getRouteIndex]);
  const onPressSavings = useCallback(() => navigateTo('Savings', getRouteIndex('Savings')), [navigateTo, getRouteIndex]);
  const onPressInsights = useCallback(() => navigateTo('Insights', getRouteIndex('Insights')), [navigateTo, getRouteIndex]);

  const scrimHeight = m.bottomGap + m.barHeight + 28;

  return (
    <>
      {/* ── Ambient Bottom Scrim / Soft Gradient Dissolve ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scrimContainer,
          {
            height: scrimHeight,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Svg height={scrimHeight} width="100%">
          <Defs>
            <SvgLinearGradient id="navBarScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="0.35" stopColor={colors.background} stopOpacity="0.4" />
              <Stop offset="0.75" stopColor={colors.background} stopOpacity="0.9" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={scrimHeight} fill="url(#navBarScrim)" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.outerContainer,
          {
            bottom: bottomOffset,
            left: m.sideMargin,
            right: m.sideMargin,
            transform: [{ translateY }],
            opacity,
          },
        ]}
        pointerEvents="box-none"
      >
      {/* ── Mode 2 (Budget ON): 5-Tab Unified Pill Bar ── */}
      <Animated.View
        style={[
          styles.barRow,
          {
            opacity: modeAnim,
            transform: [
              {
                scale: modeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
        pointerEvents={isBudgetModeEnabled ? 'auto' : 'none'}
      >
        <View
          style={[
            styles.pillBar,
            {
              maxWidth: m.barWidth,
              backgroundColor: colors.navBarBg,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.18)',
            },
          ]}
        >
          {/* Left Wing: Home & History */}
          <View style={styles.tabWing}>
            <CapsuleTabItem
              labelMax={m.budgetLabelMax}
              minWidth={m.tabMinWidth}
              icon={Home}
              label="Home"
              active={state.index === getRouteIndex('Home')}
              onPress={onPressHome}
            />
            <CapsuleTabItem
              labelMax={m.budgetLabelMax}
              minWidth={m.tabMinWidth}
              icon={Clock}
              label="History"
              active={state.index === getRouteIndex('History')}
              onPress={onPressHistory}
            />
          </View>

          {/* Center Zone: Locked at 50% */}
          <View style={[styles.centerContainer, { width: m.centerSlot }]}>
            <CenterAddButton onPress={handleAddExpense} />
          </View>

          {/* Right Wing: Savings & Insights */}
          <View style={styles.tabWing}>
            <CapsuleTabItem
              labelMax={m.budgetLabelMax}
              minWidth={m.tabMinWidth}
              icon={PiggyBankCoinIcon}
              label="Savings"
              active={state.index === getRouteIndex('Savings')}
              onPress={onPressSavings}
            />
            <CapsuleTabItem
              labelMax={m.budgetLabelMax}
              minWidth={m.tabMinWidth}
              icon={BarChart2}
              label="Insights"
              active={state.index === getRouteIndex('Insights')}
              onPress={onPressInsights}
              activeMarginRight={5}
            />
          </View>
        </View>
      </Animated.View>

      {/* ── Mode 1 (Pure Mode / Budget OFF): 3-Tab Pill on Left + Individual Circular FAB on Right ── */}
      <Animated.View
        style={[
          styles.barRow,
          StyleSheet.absoluteFill,
          {
            opacity: modeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                scale: modeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.95],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
        pointerEvents={!isBudgetModeEnabled ? 'auto' : 'none'}
      >
        <View style={styles.pureModeContainer}>
          {/* 3-Tab Capsule Pill */}
          <View
            style={[
              styles.purePillBar,
              {
                width: m.purePillWidth,
                backgroundColor: colors.navBarBg,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.18)',
              },
            ]}
          >
            <CapsuleTabItem
              labelMax={m.pureLabelMax}
              minWidth={m.tabMinWidth}
              icon={Home}
              label="Home"
              active={state.index === getRouteIndex('Home')}
              onPress={onPressHome}
            />
            <CapsuleTabItem
              labelMax={m.pureLabelMax}
              minWidth={m.tabMinWidth}
              icon={Clock}
              label="History"
              active={state.index === getRouteIndex('History')}
              onPress={onPressHistory}
            />
            <CapsuleTabItem
              labelMax={m.pureLabelMax}
              minWidth={m.tabMinWidth}
              icon={BarChart2}
              label="Insights"
              active={state.index === getRouteIndex('Insights')}
              onPress={onPressInsights}
            />
          </View>

          {/* Individual Floating Circular FAB (+) */}
          <IndividualAddButton onPress={handleAddExpense} />
        </View>
      </Animated.View>
    </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  scrimContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  outerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  barRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pureModeContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same height, radius and padding as the budget pill (pillBar); width comes from m.purePillWidth.
  purePillBar: {
    height: 68,
    borderRadius: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
    marginRight: 10,
  },
  individualFabWrapper: {
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  individualFab: {
    width: 48,
    height: 48,
    borderRadius: 24, // Same 48dp circular size as the budget mode center add button
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  pillBar: {
    width: '100%',
    maxWidth: 400,
    height: 68,
    borderRadius: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  tabWing: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 0,
  },
  centerContainer: {
    width: 68,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressable: {
    height: '100%',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13.5,
    letterSpacing: 0.15,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  addButtonWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
});
