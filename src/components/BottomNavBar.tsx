import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Clock, BarChart2, Plus } from 'lucide-react-native';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { useNavBarStore } from '../store/navBarStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';
import { Spacing, FontFamily } from '../config/theme';

// ─── Dual-Layer Cross-Fading Icon ───────────────────────────────────────────
const AnimatedIcon = ({
  icon: Icon,
  anim,
}: {
  icon: any;
  anim: Animated.Value;
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.iconWrapper}>
      {/* Inactive Icon layer */}
      <View style={styles.iconLayer}>
        <Icon size={19} color={colors.textSecondary} />
      </View>
      {/* Active Icon layer (Mint Green) */}
      <Animated.View style={[styles.iconLayer, { opacity: anim }]}>
        <Icon size={19} color={colors.mintGreen} />
      </Animated.View>
    </View>
  );
};

// ─── Expanding Active Capsule Tab Item ──────────────────────────────────────
interface CapsuleTabItemProps {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
}

const CapsuleTabItem = React.memo<CapsuleTabItemProps>(({
  icon,
  label,
  active,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.92,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  // Interpolated Capsule Background
  const capsuleBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'rgba(184, 224, 200, 0)',
      isDark ? 'rgba(184, 224, 200, 0.16)' : 'rgba(184, 224, 200, 0.22)',
    ],
    extrapolate: 'clamp',
  });

  // Interpolated Capsule Border
  const capsuleBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'rgba(184, 224, 200, 0)',
      isDark ? 'rgba(184, 224, 200, 0.3)' : 'rgba(184, 224, 200, 0.35)',
    ],
    extrapolate: 'clamp',
  });

  // Interpolated Label Width & Opacity (calibrated to prevent overflowing wings)
  const labelMaxWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 50],
    extrapolate: 'clamp',
  });

  const labelOpacity = anim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const labelMarginLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
    extrapolate: 'clamp',
  });

  const paddingHorizontal = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 8],
    extrapolate: 'clamp',
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabPressable}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }} renderToHardwareTextureAndroid={true}>
        <Animated.View
          style={[
            styles.capsule,
            {
              backgroundColor: capsuleBg,
              borderColor: capsuleBorder,
              paddingHorizontal,
            },
          ]}
        >
          <AnimatedIcon icon={icon} anim={anim} />

          <Animated.View
            style={{
              maxWidth: labelMaxWidth,
              opacity: labelOpacity,
              marginLeft: labelMarginLeft,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              transform: [{ translateY: -1.5 }],
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.tabLabel,
                { color: '#FFFFFF' },
              ]}
            >
              {label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

// ─── Center Flush Action Button (+) ──────────────────────────────────────────
const CenterAddButton = React.memo<{ onPress: () => void }>(({ onPress }) => {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.88,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.addButtonWrapper}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        renderToHardwareTextureAndroid={true}
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

// ─── Main Bottom Navigation Bar Component ───────────────────────────────────
export const BottomNavBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { colors, isDark } = useTheme();
  const { isVisible } = useNavBarStore();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 6 : 20;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isVisible ? 0 : 160 + insets.bottom,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [isVisible, translateY, insets.bottom]);

  const opacity = translateY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const getRouteIndex = useCallback(
    (name: string) => state.routes.findIndex((r) => r.name === name),
    [state.routes]
  );

  const navigateTo = useCallback(
    (routeName: string, routeIndex: number) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[routeIndex]?.key || '',
        canPreventDefault: true,
      });

      if (state.index !== routeIndex && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation, state.routes, state.index]
  );

  const handleAddExpense = useCallback(() => {
    navigation.navigate('AddExpense');
  }, [navigation]);

  const onPressHome = useCallback(() => navigateTo('Home', getRouteIndex('Home')), [navigateTo, getRouteIndex]);
  const onPressHistory = useCallback(() => navigateTo('History', getRouteIndex('History')), [navigateTo, getRouteIndex]);
  const onPressSavings = useCallback(() => navigateTo('Savings', getRouteIndex('Savings')), [navigateTo, getRouteIndex]);
  const onPressInsights = useCallback(() => navigateTo('Insights', getRouteIndex('Insights')), [navigateTo, getRouteIndex]);

  return (
    <Animated.View
      renderToHardwareTextureAndroid={true}
      style={[
        styles.outerContainer,
        {
          bottom: bottomOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* 
        Continuous Floating Capsule Pill:
        - Plus (+) button permanently locked at 50% dead-center
        - Guaranteed buffer zone around Plus button (never touches History or Savings)
        - Left & Right wings strictly symmetric with smooth expanding capsule animation
      */}
      <View
        renderToHardwareTextureAndroid={true}
        needsOffscreenAlphaCompositing={true}
        style={[
          styles.pillBar,
          {
            backgroundColor: colors.navBarBg,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.18)',
          },
        ]}
      >
        {/* Left Wing: Home & History (flex: 1, space-around) */}
        <View style={styles.tabWing}>
          <CapsuleTabItem
            icon={Home}
            label="Home"
            active={state.index === getRouteIndex('Home')}
            onPress={onPressHome}
          />
          <CapsuleTabItem
            icon={Clock}
            label="History"
            active={state.index === getRouteIndex('History')}
            onPress={onPressHistory}
          />
        </View>

        {/* Center Zone: Locked at 50% with permanent clearance buffer */}
        <View style={styles.centerContainer}>
          <CenterAddButton onPress={handleAddExpense} />
        </View>

        {/* Right Wing: Savings & Insights (flex: 1, space-around) */}
        <View style={styles.tabWing}>
          <CapsuleTabItem
            icon={PiggyBankCoinIcon}
            label="Savings"
            active={state.index === getRouteIndex('Savings')}
            onPress={onPressSavings}
          />
          <CapsuleTabItem
            icon={BarChart2}
            label="Insights"
            active={state.index === getRouteIndex('Insights')}
            onPress={onPressInsights}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: Spacing.block,
    right: Spacing.block,
    alignItems: 'center',
    zIndex: 99,
  },
  pillBar: {
    width: '100%',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
  },
  centerContainer: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    height: 42,
    borderRadius: 21,
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
    fontSize: 11.5,
    letterSpacing: 0.1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  addButtonWrapper: {
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
