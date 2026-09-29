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
  height?: number;
  fontSize?: number;
}

/**
 * Shared numeric keypad button used by AddExpenseScreen, EditExpenseScreen, and modals.
 * Includes a spring press-in/press-out animation.
 * Pass item="backspace" to render the delete icon.
 */
const KeyButtonBase: React.FC<KeyButtonProps> = ({ item, onPress, height, fontSize }) => {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const isBackspace = item === 'backspace';
  const isOperator = item === '+' || item === '−' || item === '-' || item === '×' || item === '÷' || item === '/' || item === '*';

  // Operators (÷, ×, −, +) are enlarged significantly for bold, easy-to-read visibility
  const operatorFontSize = fontSize !== undefined ? Math.round(fontSize * 1.45) : 32;
  const currentFontSize = isOperator ? operatorFontSize : (fontSize ?? 22);

  // Backspace icon size
  const deleteIconSize = fontSize !== undefined ? Math.round(fontSize * 1.15) : 24;

  const bgColor = isBackspace
    ? colors.keypadDeleteBg
    : isOperator
    ? colors.keypadOperatorBg
    : colors.keypadNumberBg;

  const borderColor = isBackspace
    ? colors.keypadDeleteBorder
    : isOperator
    ? colors.keypadOperatorBorder
    : colors.keypadNumberBorder;

  const textColor = isOperator
    ? colors.keypadOperatorText
    : colors.keypadNumberText;

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
            backgroundColor: bgColor,
            borderColor: borderColor,
            transform: [{ scale }],
          },
          height !== undefined && { height },
        ]}
      >
        {isBackspace ? (
          <Delete
            size={deleteIconSize}
            color={colors.keypadDeleteIcon}
            strokeWidth={2.2}
          />
        ) : (
          <Text
            style={[
              styles.keyText,
              {
                color: textColor,
                fontSize: currentFontSize,
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
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
