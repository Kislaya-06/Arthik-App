import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Vibration } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { ThemeColors, FontFamily, FontSize, Spacing } from '../config/theme';

export interface TelegramPullIndicatorProps {
  onTrigger: () => void;
  colors: ThemeColors;
  isDark: boolean;
}

const SVG_SIZE = 58;
const STROKE_WIDTH = 3.5;
const RADIUS = (SVG_SIZE - STROKE_WIDTH * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DRAG_THRESHOLD = 75;

export const TelegramPullIndicator: React.FC<TelegramPullIndicatorProps> = ({
  onTrigger,
  colors,
  isDark,
}) => {
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasVibratedRef = useRef(false);

  const strokeColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const resetIndicator = (fromProg = 0) => {
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();

    if (fromProg > 0) {
      let current = fromProg;
      const decay = () => {
        current -= 0.12;
        if (current <= 0) {
          setProgress(0);
        } else {
          setProgress(current);
          requestAnimationFrame(decay);
        }
      };
      requestAnimationFrame(decay);
    } else {
      setProgress(0);
    }

    setIsReady(false);
    hasVibratedRef.current = false;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 2,
      onPanResponderGrant: () => {
        hasVibratedRef.current = false;
      },
      onPanResponderMove: (_, { dy }) => {
        const dragUp = Math.max(0, -dy);
        const prog = Math.min(1, dragUp / DRAG_THRESHOLD);
        setProgress(prog);

        Animated.spring(scaleAnim, {
          toValue: 1 + prog * 0.14,
          tension: 90,
          friction: 8,
          useNativeDriver: true,
        }).start();

        const reached = prog >= 0.95;
        if (reached !== hasVibratedRef.current) {
          hasVibratedRef.current = reached;
          setIsReady(reached);
          if (reached) {
            try { Vibration.vibrate(25); } catch {}
          }
        }
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        const dragUp = Math.max(0, -dy);
        const prog = Math.min(1, dragUp / DRAG_THRESHOLD);
        const isTap = Math.abs(dx) < 8 && Math.abs(dy) < 8;

        if (prog >= 0.95 || hasVibratedRef.current || isTap) {
          Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.25, tension: 140, friction: 5, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1.0, tension: 90, friction: 7, useNativeDriver: true }),
          ]).start();

          try { Vibration.vibrate(20); } catch {}

          setTimeout(() => {
            setProgress(0);
            setIsReady(false);
            hasVibratedRef.current = false;
            onTrigger();
          }, 100);
        } else {
          resetIndicator(prog);
        }
      },
      onPanResponderTerminate: () => resetIndicator(),
    })
  ).current;

  return (
    <View style={styles.outerContainer} {...panResponder.panHandlers}>
      <Animated.View style={[styles.circleWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RADIUS}
            stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
          />
          <Circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RADIUS}
            stroke={strokeColor}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            origin={`${SVG_SIZE / 2}, ${SVG_SIZE / 2}`}
            rotation="-90"
          />
        </Svg>

        <View
          style={[
            styles.innerCircle,
            {
              backgroundColor: isReady
                ? (isDark ? 'rgba(184, 224, 200, 0.22)' : 'rgba(21, 128, 61, 0.15)')
                : colors.card,
              borderColor: isReady ? strokeColor : colors.border,
            },
          ]}
        >
          {isReady ? (
            <ArrowUp size={20} color={strokeColor} strokeWidth={2.5} />
          ) : (
            <ArrowDown size={19} color={colors.textSecondary} strokeWidth={2.2} />
          )}
        </View>
      </Animated.View>

      <Text
        style={[
          styles.label,
          {
            color: isReady ? strokeColor : colors.textSecondary,
            fontFamily: FontFamily.medium,
          },
        ]}
      >
        {isReady ? 'Release for History' : 'Pull up for History'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.gutter,
  },
  circleWrapper: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.element,
    letterSpacing: 0.2,
  },
});
