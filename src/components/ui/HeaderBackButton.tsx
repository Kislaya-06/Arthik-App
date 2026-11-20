import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { useTheme } from '../../store/themeStore';
import { PressableOpacity } from './PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';

/** Back arrow size on every pushed screen (UI-CONSISTENCY header rule). */
export const HEADER_BACK_ICON_SIZE = 24;
/** 24 icon + 10 on each side = 44dp touch target. */
const HIT_SLOP = 10;

interface HeaderBackButtonProps {
  /** Custom back action (e.g. reset to Auth). Default: go back when there is a screen to go back to. */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one back button for every pushed screen: plain 24px arrow, 44dp touch area, soft dim on press.
 * Main tabs have no back button. Never draw an ArrowLeft back button by hand in a screen.
 */
export const HeaderBackButton: React.FC<HeaderBackButtonProps> = ({ onPress, disabled, style }) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const handlePress = onPress ?? (() => {
    if (navigation.canGoBack()) navigation.goBack();
  });

  return (
    <PressableOpacity
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={handlePress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      activeOpacity={PRESS_DIM_OPACITY}
      style={style}
    >
      <ArrowLeft size={HEADER_BACK_ICON_SIZE} color={colors.textPrimary} />
    </PressableOpacity>
  );
};

export default HeaderBackButton;
