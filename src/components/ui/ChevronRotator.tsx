import React, { useEffect } from 'react';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing as REasing } from 'react-native-reanimated';
import { Motion } from '../../config/theme';

export const ChevronRotator: React.FC<{ isOpen: boolean; color: string; reduceMotion: boolean }> = React.memo(
  ({ isOpen, color, reduceMotion }) => {
    const progress = useSharedValue(isOpen ? 1 : 0);

    useEffect(() => {
      if (reduceMotion) {
        progress.value = isOpen ? 1 : 0;
        return;
      }
      progress.value = withTiming(isOpen ? 1 : 0, {
        duration: Motion.duration.snappy,
        easing: REasing.bezier(0.23, 1, 0.32, 1),
      });
    }, [isOpen, reduceMotion, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
    }));

    return (
      <Animated.View style={animatedStyle}>
        <ChevronDown size={18} color={color} />
      </Animated.View>
    );
  }
);
