import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Clock, BarChart2, User, Plus } from 'lucide-react-native';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import Svg, { Path } from 'react-native-svg';
import { useNavBarStore } from '../store/navBarStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';

// Regular tab item components with individual animations
const AnimatedIcon = ({ icon: Icon, active }: { icon: any; active: boolean }) => {
  const { colors, isDark } = useTheme();
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [active]);

  return (
    <View style={{ width: 22, height: 22 }}>
      {/* Inactive Icon layer */}
      <View style={StyleSheet.absoluteFill}>
        <Icon size={22} color={colors.textSecondary} />
      </View>
      {/* Active Icon (Mint) layer stacked on top */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
        <Icon size={22} color={colors.mintGreen} />
      </Animated.View>
    </View>
  );
};

const AnimatedDot = ({ active }: { active: boolean }) => {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (active) {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [active]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: colors.mintGreen,
          transform: [{ scale: anim }],
          opacity: anim,
        },
      ]}
    />
  );
};

interface TabItemProps {
  icon: any;
  active: boolean;
  onPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({ icon, active, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateScale(0.85)}
      onPressOut={() => animateScale(1)}
      style={styles.tabButton}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <AnimatedIcon icon={icon} active={active} />
        <AnimatedDot active={active} />
      </Animated.View>
    </Pressable>
  );
};

// ─── Custom Notched Translucent Background ──────────────────────────────────
const NotchedBackground: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const { colors, isDark } = useTheme();

  const d = useMemo(() => {
    const H = height;
    const w = width;
    const cx = w / 2;

    // Inset by 1px so the 1.2px border stroke is NEVER clipped by the SVG viewport boundary
    const pad = 1;
    const topY = pad;
    const botY = H - pad;
    const leftX = pad;
    const rightX = w - pad;
    const pillR = (H - 2 * pad) / 2; // (68 - 2) / 2 = 33

    // Proportional G2 Cubic Bézier Notch for 56px FAB in 68px bar:
    // Cradles the 28px-radius FAB with a consistent 4-5px margin and smooth horizontal exit
    const s1Start = cx - 48;
    const s1Cp1X = cx - 40;
    const s1Cp2X = cx - 34;
    const s1Cp2Y = topY + 13;
    const s1EndX = cx - 29;
    const s1EndY = topY + 18;

    const s2Cp1X = cx - 24;
    const s2Cp1Y = topY + 23;
    const s2Cp2X = cx - 15;
    const s2Cp2Y = topY + 36;
    const s2EndX = cx;
    const s2EndY = topY + 36;

    const s3Cp1X = cx + 15;
    const s3Cp1Y = topY + 36;
    const s3Cp2X = cx + 24;
    const s3Cp2Y = topY + 23;
    const s3EndX = cx + 29;
    const s3EndY = topY + 18;

    const s4Cp1X = cx + 34;
    const s4Cp1Y = topY + 13;
    const s4Cp2X = cx + 40;
    const s4EndX = cx + 48;

    return `
      M ${leftX + pillR} ${topY}
      L ${s1Start} ${topY}
      C ${s1Cp1X} ${topY}, ${s1Cp2X} ${s1Cp2Y}, ${s1EndX} ${s1EndY}
      C ${s2Cp1X} ${s2Cp1Y}, ${s2Cp2X} ${s2Cp2Y}, ${s2EndX} ${s2EndY}
      C ${s3Cp1X} ${s3Cp1Y}, ${s3Cp2X} ${s3Cp2Y}, ${s3EndX} ${s3EndY}
      C ${s4Cp1X} ${s4Cp1Y}, ${s4Cp2X} ${topY}, ${s4EndX} ${topY}
      L ${rightX - pillR} ${topY}
      A ${pillR} ${pillR} 0 0 1 ${rightX} ${H / 2}
      A ${pillR} ${pillR} 0 0 1 ${rightX - pillR} ${botY}
      L ${leftX + pillR} ${botY}
      A ${pillR} ${pillR} 0 0 1 ${leftX} ${H / 2}
      A ${pillR} ${pillR} 0 0 1 ${leftX + pillR} ${topY}
      Z
    `;
  }, [width, height]);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
      <Path
        d={d}
        fill={colors.navBarBg}
        fillOpacity={0.96}
        stroke={isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.18)'}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
};

export const BottomNavBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { colors } = useTheme();
  const { isVisible } = useNavBarStore();
  const translateY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 8 : 24;
  const fabBottom = bottomOffset + 38;

  // Center FAB Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const fabGlowOpacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isVisible ? 0 : 160 + insets.bottom, // slide fully off-screen
      useNativeDriver: true,
      bounciness: 0,
      speed: 12,
    }).start();
  }, [isVisible, translateY, insets.bottom]);

  const opacity = translateY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Center FAB pulse (subtle, continuous)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleFabPressIn = () => {
    Animated.parallel([
      Animated.timing(fabScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fabGlowOpacity, {
        toValue: 0.35,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleFabPressOut = () => {
    Animated.parallel([
      Animated.spring(fabScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(fabGlowOpacity, {
        toValue: 0.2,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleFabPress = () => {
    navigation.navigate('AddExpense');
  };

  // Map state.routes to regular tabs
  const homeRoute = state.routes.find((r) => r.name === 'Home');
  const historyRoute = state.routes.find((r) => r.name === 'History');
  const savingsRoute = state.routes.find((r) => r.name === 'Savings');
  const insightsRoute = state.routes.find((r) => r.name === 'Insights');

  const getRouteIndex = (name: string) => state.routes.findIndex((r) => r.name === name);

  const navigateTo = (routeName: string, routeIndex: number) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[routeIndex]?.key || '',
      canPreventDefault: true,
    });

    if (state.index !== routeIndex && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  // Calculate widths for the notched background dynamically based on window width
  const { width: screenWidth } = useWindowDimensions();
  const barWidth = screenWidth - 40;

  return (
    <Animated.View style={[styles.container, { height: 140 + insets.bottom, transform: [{ translateY }], opacity }]} pointerEvents="box-none">
      {/* Outer Pill Container (Shadow Wrapper) */}
      <View style={[styles.pillContainerShadowWrapper, { bottom: bottomOffset }]}>
        {/* Custom SVG Notched Background Layer */}
        <NotchedBackground width={barWidth} height={68} />

        {/* Inner row container for tab elements */}
        <View style={styles.tabsInnerRow}>
          {/* Regular Tabs: 2 on Left */}
          {homeRoute && (
            <TabItem
              icon={Home}
              active={state.index === getRouteIndex('Home')}
              onPress={() => navigateTo('Home', getRouteIndex('Home'))}
            />
          )}
          {historyRoute && (
            <TabItem
              icon={Clock}
              active={state.index === getRouteIndex('History')}
              onPress={() => navigateTo('History', getRouteIndex('History'))}
            />
          )}

          {/* Center Space Placeholder for FAB */}
          <View style={styles.fabSpacer} />

          {/* Regular Tabs: 2 on Right */}
          {savingsRoute && (
            <TabItem
              icon={PiggyBankCoinIcon}
              active={state.index === getRouteIndex('Savings')}
              onPress={() => navigateTo('Savings', getRouteIndex('Savings'))}
            />
          )}
          {insightsRoute && (
            <TabItem
              icon={BarChart2}
              active={state.index === getRouteIndex('Insights')}
              onPress={() => navigateTo('Insights', getRouteIndex('Insights'))}
            />
          )}
        </View>
      </View>

      {/* Floating Center Action Button (FAB) */}
      <View style={[styles.fabContainer, { bottom: fabBottom }]} pointerEvents="box-none">
        <Pressable
          onPress={handleFabPress}
          onPressIn={handleFabPressIn}
          onPressOut={handleFabPressOut}
          style={styles.fabPressable}
        >
          {/* Outer glow ring */}
          <Animated.View
            style={[
              styles.fabGlow,
              {
                backgroundColor: colors.mintGreen,
                transform: [{ scale: pulseAnim }],
                opacity: fabGlowOpacity,
              },
            ]}
          />
          {/* Main button circle */}
          <Animated.View
            style={[
              styles.fabButton,
              {
                backgroundColor: colors.mintGreen,
                shadowColor: colors.mintGreen,
                transform: [{ scale: fabScale }],
              },
            ]}
          >
            <Plus size={24} color={colors.forestGreen} strokeWidth={2.6} />
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140, // Explicit height to prevent Android touch clipping on absolute children
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  pillContainerShadowWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 68,
    borderRadius: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
    backgroundColor: 'transparent',
  },

  tabsInnerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  tabButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#B8E0C8',
    marginTop: 3,
  },
  fabSpacer: {
    width: 54,
    height: 68,
  },
  fabContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    zIndex: 11,
  },
  fabPressable: {
    width: 56,
    height: 56,
    position: 'relative',
  },
  fabGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B8E0C8',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B8E0C8',
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B8E0C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
});
