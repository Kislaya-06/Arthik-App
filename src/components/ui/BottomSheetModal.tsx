import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  useAnimatedValue,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, FontFamily, FontSize, Spacing, BorderRadius } from '../../config/theme';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  colors: ThemeColors;
  isDark: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  title,
  headerLeft,
  headerRight,
  children,
  footer,
  colors,
  isDark,
  contentStyle,
  containerStyle,
}) => {
  const insets = useSafeAreaInsets();
  const [isMounted, setIsMounted] = useState(visible);
  const slideAnim = useAnimatedValue(500);
  const fadeAnim = useAnimatedValue(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!isMounted) return null;

  return (
    <Modal visible={isMounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.55],
              }),
            },
          ]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.borderSubtle,
              borderWidth: isDark ? 1 : 0,
              paddingBottom: Math.max(insets.bottom, Spacing.block),
              transform: [{ translateY: slideAnim }],
            },
            containerStyle,
          ]}
        >
          {/* Header Row */}
          {(title || headerLeft || headerRight) && (
            <View style={styles.headerRow}>
              {headerLeft ? (
                headerLeft
              ) : (
                <View style={{ width: 36 }} />
              )}
              {title ? (
                <Text
                  style={[
                    styles.headerTitle,
                    { color: colors.textPrimary, fontFamily: FontFamily.bold },
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              ) : null}
              {headerRight ? (
                headerRight
              ) : (
                <Pressable
                  style={[
                    styles.closeBtn,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
                  ]}
                  onPress={onClose}
                  hitSlop={8}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Close sheet"
                >
                  <X size={18} color={colors.textPrimary} />
                </Pressable>
              )}
            </View>
          )}

          <View style={[styles.contentContainer, contentStyle]}>{children}</View>

          {footer ? <View style={styles.footerContainer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    paddingTop: Spacing.surface,
    paddingHorizontal: Spacing.gutter,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.block,
  },
  headerTitle: {
    fontSize: FontSize.titleMedium,
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexShrink: 1,
  },
  footerContainer: {
    marginTop: Spacing.block,
  },
});
