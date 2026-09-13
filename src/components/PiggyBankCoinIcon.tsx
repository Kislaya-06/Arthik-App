import React from 'react';
import Svg, { Path, Circle, SvgProps } from 'react-native-svg';

interface PiggyBankCoinIconProps extends SvgProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Custom vector icon representing a Piggy Bank with a Coin dropping into it,
 * crafted to match the user's reference silhouette with precision.
 */
export const PiggyBankCoinIcon: React.FC<PiggyBankCoinIconProps> = ({
  size = 24,
  color = 'currentColor',
  style,
  ...props
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      {...props}
    >
      {/* ── Coin Circle (Top-Left) with '₹' (Rupee) Cutout ── */}
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="
          M 7.5 1.0
          A 5.0 5.0 0 1 0 7.501 1.0
          Z
          M 5.5 3.4
          H 9.2
          V 4.1
          H 6.3
          V 4.7
          H 8.5
          V 5.35
          H 6.3
          V 5.6
          C 7.3 5.6 8.0 5.9 8.3 6.4
          C 8.5 6.7 8.5 7.1 8.2 7.5
          L 9.2 8.8
          H 8.1
          L 6.3 6.7
          V 8.8
          H 5.5
          Z
        "
      />

      {/* ── Piggy Bank Body Silhouette with Eye Cutout ── */}
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="
          M 13.4 8.2
          C 13.8 6.5 14.8 4.2 15.6 3.6
          C 16.2 3.2 16.7 4.2 16.5 6.2
          C 17.5 7.2 18.5 8.6 18.5 10.2
          L 21.0 10.2
          C 21.6 10.2 22.0 10.6 22.0 11.2
          L 22.0 13.0
          C 22.0 13.6 21.6 14.0 21.0 14.0
          L 18.8 14.0
          C 18.3 15.8 17.2 17.2 15.8 17.8
          L 15.8 20.8
          C 15.8 21.3 15.3 21.8 14.8 21.8
          L 13.2 21.8
          C 12.7 21.8 12.2 21.3 12.2 20.8
          L 12.2 18.6
          C 11.6 18.4 11.0 18.4 10.4 18.6
          L 10.4 20.8
          C 10.4 21.3 9.9 21.8 9.4 21.8
          L 7.8 21.8
          C 7.3 21.8 6.8 21.3 6.8 20.8
          L 6.8 17.8
          C 5.2 16.6 4.0 14.8 3.8 12.6
          C 3.6 11.2 4.0 9.8 4.8 8.6
          C 4.4 9.5 4.2 10.5 4.2 11.4
          C 4.2 13.4 5.6 14.8 7.5 14.8
          C 9.4 14.8 11.2 13.6 11.8 11.6
          C 12.2 10.4 12.4 9.2 13.4 8.2
          Z
          M 16.8 9.8
          A 0.85 0.85 0 1 0 16.801 9.8
          Z
        "
      />
    </Svg>
  );
};

export default PiggyBankCoinIcon;
