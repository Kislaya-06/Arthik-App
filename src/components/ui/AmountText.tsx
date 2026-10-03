import React from 'react';
import { Text, View, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { FontFamily, LineHeight, FontSize } from '../../config/theme';
import { RollingText } from '../RollingText';

export type AmountRole = 'hero' | 'primary' | 'row' | 'compact' | 'metric';
export type AmountDirection = 'expense' | 'income' | 'neutral';

export interface AmountTextProps {
  value: number;
  role?: AmountRole;
  direction?: AmountDirection;
  signed?: boolean;
  showDecimals?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  /** Test ID for automated component tests */
  testID?: string;
  /** true = the digits roll (odometer style) whenever the value changes. Default false (plain text). */
  rolling?: boolean;
  /** true = rolls up from zero whenever the screen gains focus. */
  rollOnFocus?: boolean;
}

/**
 * Standardized AmountText primitive for Arthik.
 * Enforces the Real-Money Invariant: every rupee has clear visual emphasis,
 * Indian grouping, optical symbol alignment, and screen-reader accessibility.
 */
export const AmountText: React.FC<AmountTextProps> = ({
  value,
  role = 'primary',
  direction = 'neutral',
  signed = false,
  showDecimals = false,
  color,
  style,
  accessibilityLabel,
  testID,
  rolling = false,
  rollOnFocus,
}) => {
  const { colors } = useTheme();
  const numVal = Number(value) || 0;
  const isNegative = numVal < 0 || direction === 'expense';
  const isPositive = direction === 'income' && numVal > 0;
  const absVal = Math.abs(numVal);

  // Format with Indian grouping
  const formattedNumber = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : (absVal % 1 !== 0 ? 2 : 0),
  });

  // Determine prefix
  let prefix = '₹';
  if (signed) {
    if (isPositive) {
      prefix = '+₹';
    } else if (isNegative && numVal !== 0) {
      prefix = '-₹';
    }
  } else if (numVal < 0) {
    prefix = '-₹';
  }

  // Determine semantic color if not overridden
  const resolvedColor = color || (
    direction === 'income'
      ? (colors.isDark ? colors.mint : colors.mintDark)
      : direction === 'expense'
        ? (colors.isDark ? colors.coral : colors.peachCoral)
        : colors.textPrimary
  );

  // Auto accessibility label if not provided
  const resolvedA11yLabel = accessibilityLabel || (
    `${signed && isPositive ? 'plus ' : ''}${signed && isNegative ? 'minus ' : ''}${formattedNumber} rupees${direction !== 'neutral' ? ` ${direction}` : ''}`
  );

  // Optical alignment for Hero role
  if (role === 'hero') {
    return (
      <View
        style={rolling ? [styles.heroRow, styles.heroRowFill] : styles.heroRow}
        accessible
        accessibilityRole="text"
        accessibilityLabel={resolvedA11yLabel}
        testID={testID}
      >
        <Text
          style={[
            styles.heroSymbol,
            { color: resolvedColor },
            style,
          ]}
        >
          {prefix}
        </Text>
        {rolling ? (
          <RollingText
            text={formattedNumber}
            style={StyleSheet.flatten([styles.heroNumber, { color: resolvedColor }, style])}
            containerStyle={styles.heroRolling}
            minScale={0.65}
            rollOnFocus={rollOnFocus}
          />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            style={[
              styles.heroNumber,
              { color: resolvedColor },
              style,
            ]}
          >
            {formattedNumber}
          </Text>
        )}
      </View>
    );
  }

  // Other standard roles
  const roleStyle = getRoleStyle(role);

  if (rolling) {
    return (
      <RollingText
        text={`${prefix}${formattedNumber}`}
        style={StyleSheet.flatten([roleStyle, { color: resolvedColor }, style])}
        accessibilityLabel={resolvedA11yLabel}
        testID={testID}
        rollOnFocus={rollOnFocus}
      />
    );
  }

  return (
    <Text
      accessible
      accessibilityRole="text"
      accessibilityLabel={resolvedA11yLabel}
      style={[
        roleStyle,
        { color: resolvedColor },
        style,
      ]}
      testID={testID}
    >
      {prefix}{formattedNumber}
    </Text>
  );
};

const getRoleStyle = (role: AmountRole): TextStyle => {
  switch (role) {
    case 'primary':
      return {
        fontFamily: FontFamily.bold,
        fontSize: 24,
        lineHeight: LineHeight.titleLarge,
      };
    case 'row':
      return {
        fontFamily: FontFamily.semibold,
        fontSize: FontSize.body,
        lineHeight: LineHeight.body,
      };
    case 'compact':
      return {
        fontFamily: FontFamily.semibold,
        fontSize: FontSize.bodySmall,
        lineHeight: LineHeight.bodySmall,
      };
    case 'metric':
      return {
        fontFamily: FontFamily.bold,
        fontSize: FontSize.caption,
        lineHeight: LineHeight.caption,
      };
    default:
      return {
        fontFamily: FontFamily.bold,
        fontSize: 24,
        lineHeight: 30,
      };
  }
};

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Lets the rolling number take the remaining width so it can measure itself for fit-to-width.
  heroRolling: {
    flex: 1,
  },
  // When rolling, the row itself must have a width that does not depend on its content, whether its parent is a
  // column (stretches anyway) or a row (Insights / Category Detail): grow into the free space, never collapse.
  heroRowFill: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  heroSymbol: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
    marginRight: 2,
  },
  heroNumber: {
    fontFamily: FontFamily.bold,
    fontSize: 36,
    lineHeight: LineHeight.display,
  },
});
