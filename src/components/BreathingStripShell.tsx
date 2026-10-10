import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { RollingText } from './RollingText';

export interface BreathingStripTileConfig {
  label: string;
  value: string;
  valueColor?: string;
  unit?: string;
  subtext?: string;
  subtextFontFamily?: string;
  subtextStyle?: StyleProp<TextStyle>;
  subtextNumberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
  pillText?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'none' | 'header' | 'link' | 'image' | 'text';
}

export interface BreathingStripShellProps {
  takeawayText: string;
  takeawayStatus?: 'coral' | 'mintGreen' | 'neutral' | string;
  dotColor?: string;
  leftTile: BreathingStripTileConfig;
  rightTile: BreathingStripTileConfig;
  style?: StyleProp<ViewStyle>;
}

export const BreathingStripShell: React.FC<BreathingStripShellProps> = ({
  takeawayText,
  takeawayStatus,
  dotColor: customDotColor,
  leftTile,
  rightTile,
  style,
}) => {
  const { colors, isDark } = useTheme();

  // Vibrant status dot: coral for alerts, mint green for takeaways/positive
  const dotColor =
    customDotColor ||
    (takeawayStatus === 'coral' ? '#FF7A6E' : colors.mintGreen);

  const renderTile = (tile: BreathingStripTileConfig, isRight: boolean) => {
    const Container = tile.onPress ? Pressable : View;
    const containerProps = tile.onPress
      ? {
          onPress: tile.onPress,
          disabled: !tile.onPress,
          hitSlop: 6,
          accessibilityRole: tile.accessibilityRole || 'button',
          accessibilityLabel: tile.accessibilityLabel,
        }
      : {
          accessible: true,
          accessibilityLabel: tile.accessibilityLabel,
        };

    return (
      <Container
        style={isRight ? styles.tileColRight : styles.tileCol}
        {...(containerProps as any)}
      >
        <Text
          style={[
            styles.tileLabel,
            { color: colors.textSecondary, fontFamily: FontFamily.bold },
          ]}
        >
          {tile.label}
        </Text>

        <View style={styles.valueRow}>
          <RollingText
            text={tile.value}
            style={{
              fontSize: 20,
              lineHeight: 26,
              fontFamily: FontFamily.bold,
              color: tile.valueColor || colors.textPrimary,
            }}
            rollOnFocus
          />
          {tile.unit ? (
            <Text
              style={[
                styles.tileUnit,
                { color: colors.textSecondary, fontFamily: FontFamily.medium },
              ]}
            >
              {tile.unit}
            </Text>
          ) : null}
        </View>

        {tile.subtext ? (
          <Text
            style={[
              styles.tileSubtext,
              {
                color: colors.textSecondary,
                fontFamily: tile.subtextFontFamily || FontFamily.medium,
              },
              tile.subtextStyle,
            ]}
            numberOfLines={tile.subtextNumberOfLines ?? 2}
            adjustsFontSizeToFit={tile.adjustsFontSizeToFit}
            minimumFontScale={tile.minimumFontScale}
          >
            {tile.subtext}
          </Text>
        ) : null}

        {tile.pillText ? (
          <View
            style={[
              styles.savingsPill,
              {
                backgroundColor: isDark
                  ? 'rgba(184, 224, 200, 0.14)'
                  : colors.mintGreenSoft,
                borderColor: colors.mintGreen,
              },
            ]}
          >
            <Text
              style={[
                styles.savingsPillText,
                {
                  color: isDark ? colors.mintGreen : colors.mintGreenDark,
                  fontFamily: FontFamily.bold,
                },
              ]}
              numberOfLines={1}
            >
              {tile.pillText}
            </Text>
          </View>
        ) : null}
      </Container>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: isDark ? 1 : 0,
        },
        style,
      ]}
    >
      {/* ── Top Row: Smart Takeaway ── */}
      <View style={styles.takeawayRow}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text
          style={[
            styles.takeawayText,
            { color: colors.textPrimary, fontFamily: FontFamily.semibold },
          ]}
          numberOfLines={2}
        >
          {takeawayText}
        </Text>
      </View>

      {/* Subtle Divider */}
      <View
        style={[styles.divider, { backgroundColor: colors.borderSubtle }]}
      />

      {/* ── Bottom Row: Dual Spacious Tiles ── */}
      <View style={styles.dualTilesRow}>
        {renderTile(leftTile, false)}

        {/* Vertical Divider */}
        <View
          style={[
            styles.verticalDivider,
            { backgroundColor: colors.borderSubtle },
          ]}
        />

        {renderTile(rightTile, true)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.card, // 20
    padding: Spacing.block, // 16
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  takeawayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.element,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  takeawayText: {
    fontSize: FontSize.bodySmall, // 14
    lineHeight: 19,
    flex: 1,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 12,
  },
  dualTilesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tileCol: {
    flex: 1,
    paddingRight: 10,
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 2,
  },
  tileColRight: {
    flex: 1,
    paddingLeft: 12,
  },
  tileLabel: {
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.nano,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tileUnit: {
    fontSize: 12.5,
  },
  tileSubtext: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  savingsPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 0.8,
    marginTop: 5,
  },
  savingsPillText: {
    fontSize: 11,
  },
});
