import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { getBadgeGradientColors } from '../lib/colorUtils';

let badgeGradCounter = 0;

export interface GradientIconBadgeProps {
  size?: number;
  color?: string;
  isDark?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode | ((props: { iconColor: string }) => React.ReactNode);
}

export const GradientIconBadge: React.FC<GradientIconBadgeProps> = ({
  size = 48,
  color = '#ADEBB3',
  isDark = false,
  style,
  children,
}) => {
  const radius = size / 2;
  const cleanColor = (color || '#ADEBB3').trim();

  const gradId = useMemo(() => {
    badgeGradCounter = (badgeGradCounter + 1) % 1000000;
    return `ibadge_${cleanColor.replace(/[^a-zA-Z0-9]/g, '')}_${badgeGradCounter}`;
  }, [cleanColor]);

  const { startColor, midColor, endColor, strokeColor, iconColor } = useMemo(
    () => getBadgeGradientColors(cleanColor, isDark),
    [cleanColor, isDark]
  );

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1="12%" y1="0%" x2="88%" y2="100%">
            <Stop offset="0%" stopColor={startColor} />
            <Stop offset="50%" stopColor={midColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={radius}
          cy={radius}
          r={radius - 0.5}
          fill={`url(#${gradId})`}
          stroke={strokeColor}
          strokeWidth={1}
        />
      </Svg>
      {typeof children === 'function' ? children({ iconColor }) : children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
