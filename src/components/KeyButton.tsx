import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Delete } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

/**
 * The pixel width of each keypad button.
 * (screenWidth − horizontal padding 48 − gaps 24) / 3 columns
 */
export const KEY_WIDTH = (screenWidth - 48 - 24) / 3;

interface KeyButtonProps {
  item: string;
  onPress: (val: string) => void;
}

/**
 * Shared numeric keypad button used by AddExpenseScreen and EditExpenseScreen.
 * Includes a spring press-in/press-out animation.
 * Pass item="backspace" to render the delete icon.
 */
export const KeyButton: React.FC<KeyButtonProps> = ({ item, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const isBackspace = item === 'backspace';

  return (
    <Pressable
      onPress={() => onPress(item)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.keyButton,
          { transform: [{ scale }] },
          isBackspace ? styles.keyButtonBackspace : styles.keyButtonNormal,
        ]}
      >
        {isBackspace ? (
          <Delete size={20} color="#F4B8AE" />
        ) : (
          <Text style={styles.keyText}>{item}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  keyButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F1F4',
    width: KEY_WIDTH,
    height: 56,
  },
  keyButtonNormal: {
    backgroundColor: '#FFFFFF',
  },
  keyButtonBackspace: {
    backgroundColor: '#FDEEEC',
  },
  keyText: {
    fontSize: 24,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
});
