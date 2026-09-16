import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, Wifi, X, RefreshCw } from 'lucide-react-native';
import { useNetworkStore } from '../store/networkStore';
import { useTheme } from '../store/themeStore';

export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const isOffline = useNetworkStore((s) => s.isOffline);
  const bannerVisible = useNetworkStore((s) => s.bannerVisible);
  const bannerMessage = useNetworkStore((s) => s.bannerMessage);
  const isSyncing = useNetworkStore((s) => s.isSyncing);
  const dismissBanner = useNetworkStore((s) => s.dismissBanner);

  const [shouldRender, setShouldRender] = useState(bannerVisible);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (bannerVisible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [bannerVisible]);

  if (!shouldRender) return null;

  const isOnlineRestored = !isOffline;

  // Visual styling depending on offline vs back online
  const bgColor = isOnlineRestored
    ? (isDark ? '#064E3B' : '#ECFDF5')
    : (isDark ? '#2D1B08' : '#FFFBEB');

  const borderColor = isOnlineRestored
    ? (isDark ? '#059669' : '#A7F3D0')
    : (isDark ? '#B45309' : '#FDE68A');

  const textColor = isOnlineRestored
    ? (isDark ? '#6EE7B7' : '#065F46')
    : (isDark ? '#FCD34D' : '#92400E');

  const iconColor = textColor;

  return (
    <Animated.View
      pointerEvents={bannerVisible ? 'auto' : 'none'}
      style={[
        styles.wrapper,
        {
          top: Math.max(insets.top, 12) + 6,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.iconBox}>
            {isOnlineRestored ? (
              isSyncing ? (
                <RefreshCw size={16} color={iconColor} />
              ) : (
                <Wifi size={16} color={iconColor} />
              )
            ) : (
              <WifiOff size={16} color={iconColor} />
            )}
          </View>
          <Text
            numberOfLines={2}
            style={[
              styles.text,
              { color: textColor, fontFamily: 'Quicksand_600SemiBold' },
            ]}
          >
            {bannerMessage}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={dismissBanner}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={15} color={textColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconBox: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
