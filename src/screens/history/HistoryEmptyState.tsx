import React, { useEffect } from 'react';
import { Motion } from '../../config/theme';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing as REasing } from 'react-native-reanimated';
import { EmptyState } from '../../components/ui/EmptyState';
import { styles } from '../HistoryScreen.styles';

export interface EmptyStateViewProps {
  IconComponent: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  style: any;
  isReady: boolean;
  reduceMotion: boolean;
  actionButton?: {
    label: string;
    onPress: () => void;
  };
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = React.memo(({
  IconComponent,
  title,
  subtitle,
  style,
  isReady,
  reduceMotion,
  actionButton,
}) => {
  const anim = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      anim.value = 1;
      return;
    }
    anim.value = 0;
    anim.value = withTiming(1, {
      duration: Motion.duration.snappy,
      easing: REasing.bezier(0.23, 1, 0.32, 1),
    });
  }, [title, reduceMotion, anim]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: isReady ? anim.value : 0,
      transform: [{ scale: interpolate(anim.value, [0, 1], [0.96, 1]) }],
    };
  });

  return (
    <Animated.View style={[styles.emptyContainer, style, animatedStyle]}>
      <EmptyState
        icon={IconComponent}
        title={title}
        subtitle={subtitle}
        action={actionButton}
      />
    </Animated.View>
  );
});
