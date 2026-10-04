import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { KeyButton } from '../KeyButton';
import { KeypadKey } from '../../lib/amountKeypad';

export interface KeypadGridProps {
  onKeyPress: (val: string) => void;
  hasOperators?: boolean;
  buttonHeight?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}

const STANDARD_KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

const OPERATOR_KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3', '÷'],
  ['4', '5', '6', '×'],
  ['7', '8', '9', '−'],
  ['.', '0', 'backspace', '+'],
];

export const KeypadGrid: React.FC<KeypadGridProps> = ({
  onKeyPress,
  hasOperators = false,
  buttonHeight,
  fontSize,
  style,
}) => {
  const rows = hasOperators ? OPERATOR_KEYPAD_ROWS : STANDARD_KEYPAD_ROWS;

  return (
    <View style={[styles.keypadContainer, style]}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.keypadRow}>
          {row.map((k) => (
            <KeyButton
              key={k}
              item={k}
              onPress={onKeyPress}
              height={buttonHeight}
              fontSize={fontSize}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  keypadContainer: {
    width: '100%',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
