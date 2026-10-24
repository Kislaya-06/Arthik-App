import { forwardRef } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';

export type PressableOpacityProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  activeOpacity?: number;
};

/** Drop-in pressable component: same default activeOpacity (0.2), but Pressable-based for instant native feedback. */
export const PressableOpacity = forwardRef<View, PressableOpacityProps>(
  ({ style, activeOpacity = 0.2, ...rest }, ref) => (
    <Pressable
      ref={ref}
      {...rest}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && { opacity: activeOpacity },
      ]}
    />
  )
);

PressableOpacity.displayName = 'PressableOpacity';

export default PressableOpacity;
