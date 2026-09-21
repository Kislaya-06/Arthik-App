import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  Text,
  StyleSheet,
} from 'react-native';
import { Delete } from 'lucide-react-native';
import { useTheme } from '../store/themeStore';
import { BorderRadius, FontFamily } from '../config/theme';

interface KeyButtonProps {
  item: string;
  onPress: (val: string) => void;
}

/**
 * Shared numeric keypad button used by AddExpenseScreen and EditExpenseScreen.
 * Includes a spring press-in/press-out animation.
 * Pass item="backspace" to render the delete icon.
 */
const KeyButtonBase: React.FC<KeyButtonProps> = ({ item, onPress }) => {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const isBackspace = item === 'backspace';
  const isOperator = item === '+' || item === '−' || item === '×' || item === '÷';

  return (
    <Pressable
      style={styles.keyPressable}
      onPress={() => onPress(item)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.keyButton,
          {
            borderColor: isOperator && isDark ? 'rgba(184, 224, 200, 0.25)' : colors.borderSubtle,
            backgroundColor: isBackspace
              ? colors.peachSoft
              : isOperator
              ? (isDark ? 'rgba(184, 224, 200, 0.15)' : colors.mintGreenSoft)
              : colors.cardSubtle,
            transform: [{ scale }],
          },
        ]}
      >
        {isBackspace ? (
          <Delete size={20} color={colors.peachCoral} />
        ) : (
          <Text
            style={[
              styles.keyText,
              {
                color: isOperator
                  ? (isDark ? colors.mintGreen : colors.mintGreenDark)
                  : colors.textPrimary,
              },
            ]}
          >
            {item}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
};

export const KeyButton = React.memo(KeyButtonBase);

const styles = StyleSheet.create({
  keyPressable: {
    flex: 1,
  },
  keyButton: {
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    height: 52,
  },
  keyText: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
  },
});
