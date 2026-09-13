import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Clock, BarChart2, Plus } from 'lucide-react-native';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { useNavBarStore } from '../store/navBarStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';

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
      <View style={StyleSheet.absoluteFill}>
        <Icon size={20} color={colors.textSecondary} />
      </View>
      {/* Active Icon layer (Mint Green) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <Icon size={20} color={colors.mintGreen} />
      </Animated.View>
    </View>
  );
};

// ─── Perfectly Balanced Tab Item (5-Column Grid) ────────────────────────────
interface TabItemProps {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  icon,
  label,
  active,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      tension: 60,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [active]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const capsuleBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'rgba(184, 224, 200, 0)',
      isDark ? 'rgba(184, 224, 200, 0.15)' : 'rgba(184, 224, 200, 0.22)',
    ],
  });

  const capsuleBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'rgba(184, 224, 200, 0)',
      isDark ? 'rgba(184, 224, 200, 0.28)' : 'rgba(184, 224, 200, 0.35)',
    ],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabPressable}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Animated.View
          style={[
            styles.capsule,
            {
              backgroundColor: capsuleBg,
              borderColor: capsuleBorder,
            },
          ]}
        >
          <AnimatedIcon icon={icon} anim={anim} />
          <Text
            numberOfLines={1}
            style={[
              styles.tabLabel,
              {
                color: active ? colors.mintGreen : colors.textSecondary,
                fontFamily: active ? 'Quicksand_700Bold' : 'Quicksand_600SemiBold',
              },
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

// ─── Center Flush Action Button (+) ──────────────────────────────────────────
const CenterAddButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
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
};

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

  const handleAddExpense = () => {
    navigation.navigate('AddExpense');
  };

  return (
    <Animated.View
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
        Symmetric Floating Capsule Pill:
        5 EQUAL COLUMNS (20% EACH) — 100% Mathematical Consistency:
        - Slot 1: Home (10%)
        - Slot 2: History (30%)
        - Slot 3: Add (+) (50% Dead Center)
        - Slot 4: Savings (70%)
        - Slot 5: Insights (90%)
      */}
      <View
        style={[
          styles.pillBar,
          {
            backgroundColor: colors.navBarBg,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.18)',
          },
        ]}
      >
        {/* Slot 1: Home */}
        <View style={styles.slot}>
          <TabItem
            icon={Home}
            label="Home"
            active={state.index === getRouteIndex('Home')}
            onPress={() => navigateTo('Home', getRouteIndex('Home'))}
          />
        </View>

        {/* Slot 2: History */}
        <View style={styles.slot}>
          <TabItem
            icon={Clock}
            label="History"
            active={state.index === getRouteIndex('History')}
            onPress={() => navigateTo('History', getRouteIndex('History'))}
          />
        </View>

        {/* Slot 3: Center Plus Action Button */}
        <View style={styles.slot}>
          <CenterAddButton onPress={handleAddExpense} />
        </View>

        {/* Slot 4: Savings */}
        <View style={styles.slot}>
          <TabItem
            icon={PiggyBankCoinIcon}
            label="Savings"
            active={state.index === getRouteIndex('Savings')}
            onPress={() => navigateTo('Savings', getRouteIndex('Savings'))}
          />
        </View>

        {/* Slot 5: Insights */}
        <View style={styles.slot}>
          <TabItem
            icon={BarChart2}
            label="Insights"
            active={state.index === getRouteIndex('Insights')}
            onPress={() => navigateTo('Insights', getRouteIndex('Insights'))}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99,
  },
  pillBar: {
    width: '100%',
    height: 66,
    borderRadius: 33,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    width: 56,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 3,
  },
  iconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  addButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
});
