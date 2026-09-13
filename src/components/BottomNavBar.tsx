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
    const r = 36;
    const H = height;
    const w = width;
    const cx = w / 2;
    
    // Mathematically calculated tangent arcs for a perfectly smooth cutout
    // R = 42 (radius of the main notch cutout, giving enough room for the pulsing glow ring)
    // r_f = 12 (radius of the top corner fillets transitioning into the notch)
    const p1x = cx - 52.65;
    const p2x = cx - 40.95;
    const p2y = 9.33;
    const p3x = cx + 40.95;
    const p3y = 9.33;
    const p4x = cx + 52.65;

    return `
      M ${r} 0
      L ${p1x} 0
      A 12 12 0 0 1 ${p2x} ${p2y}
      A 42 42 0 0 0 ${p3x} ${p3y}
      A 12 12 0 0 1 ${p4x} 0
      L ${w - r} 0
      A ${r} ${r} 0 0 1 ${w} ${H / 2}
      A ${r} ${r} 0 0 1 ${w - r} ${H}
      L ${r} ${H}
      A ${r} ${r} 0 0 1 0 ${H / 2}
      A ${r} ${r} 0 0 1 ${r} 0
      Z
    `;
  }, [width, height]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Path
        d={d}
        fill={colors.navBarBg}
        fillOpacity={0.96}
        stroke={isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.15)"}
        strokeWidth={1.2}
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
  const fabBottom = bottomOffset + 36;

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
        <NotchedBackground width={barWidth} height={72} />

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
          {insightsRoute && (
            <TabItem
              icon={BarChart2}
              active={state.index === getRouteIndex('Insights')}
              onPress={() => navigateTo('Insights', getRouteIndex('Insights'))}
            />
          )}
          {/* 4. Profile Button (Navigates to Stack Screen) */}
          <TabItem
            icon={User}
            active={false} // Stack screen overlay, doesn't stay active in Tab bar
            onPress={() => navigation.navigate('Profile' as any)}
          />
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
            <Plus size={26} color={colors.forestGreen} strokeWidth={2.5} />
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
    height: 72,
    borderRadius: 36,
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
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
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#B8E0C8',
    marginTop: 4,
  },
  fabSpacer: {
    width: 64,
    height: 72,
  },
  fabContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    zIndex: 11,
  },
  fabPressable: {
    width: 72,
    height: 72,
    position: 'relative',
  },
  fabGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#B8E0C8',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fabButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#B8E0C8',
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B8E0C8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
});
