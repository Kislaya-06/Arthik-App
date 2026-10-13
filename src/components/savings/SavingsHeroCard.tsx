import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Trophy, Sparkles, Plus } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { PiggyBankCoinIcon } from '../PiggyBankCoinIcon';
import { GradientIconBadge } from '../GradientIconBadge';
import { MoneyHelpBadge } from '../MoneyExplainerModal';
import { AmountText } from '../ui/AmountText';
import { Spacing } from '../../config/theme';
import { styles } from '../../screens/SavingsScreen.styles';

export interface SavingsHeroCardProps {
  heroCardSize: { width: number; height: number };
  setHeroCardSize: (size: { width: number; height: number }) => void;
  budgetCadence: string;
  onOpenExplainer: () => void;
  triggerPiggyBounce: () => void;
  heroPiggyScale: Animated.Value;
  totalAccumulatedSavings: number;
  effectiveBestStreak: number;
  savedDaysCount: number;
  onOpenDepositModal: () => void;
  isDark: boolean;
}

export const SavingsHeroCard: React.FC<SavingsHeroCardProps> = ({
  heroCardSize,
  setHeroCardSize,
  budgetCadence,
  onOpenExplainer,
  triggerPiggyBounce,
  heroPiggyScale,
  totalAccumulatedSavings,
  effectiveBestStreak,
  savedDaysCount,
  onOpenDepositModal,
  isDark,
}) => {
  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: '#581C87',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          overflow: 'hidden',
          elevation: isDark ? 0 : 2,
        },
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== heroCardSize.width || height !== heroCardSize.height)) {
          setHeroCardSize({ width, height });
        }
      }}
    >
      {/* Violet Premium Background Gradient */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg
          width={heroCardSize.width || '100%'}
          height={heroCardSize.height || '100%'}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgLinearGradient id="gullakCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#8B5CF6" />
              <Stop offset="100%" stopColor="#581C87" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={heroCardSize.width || '100%'}
            height={heroCardSize.height || '100%'}
            fill="url(#gullakCardGrad)"
          />
        </Svg>
      </View>

      {/* Header Row: Title on Left, Piggy Icon Badge on Right */}
      <View style={styles.heroTopRow}>
        <View style={styles.heroTitleWrap}>
          <Text style={[styles.heroSub, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            Total Lifetime Savings
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <Text
              style={[styles.heroTitle, { color: '#FFFFFF' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Your {budgetCadence === 'weekly' ? 'Weekly' : budgetCadence === 'monthly' ? 'Monthly' : 'Daily'} Gullak
            </Text>
            <MoneyHelpBadge
              size={18}
              style={{ marginLeft: Spacing.element }}
              onPress={onOpenExplainer}
            />
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={triggerPiggyBounce}
          style={[styles.heroIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
        >
          <Animated.View style={{ transform: [{ scale: heroPiggyScale }] }}>
            <PiggyBankCoinIcon size={28} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Large currency amount using canonical AmountText */}
      <View style={styles.heroAmountBlock}>
        <AmountText
          role="hero"
          value={totalAccumulatedSavings}
          color="#FFFFFF"
          rolling
          rollOnFocus
        />
        <Text style={[styles.heroHelperText, { color: 'rgba(255, 255, 255, 0.8)' }]}>
          {`Auto-saved from unspent ${budgetCadence === 'weekly' ? 'weekly budget' : budgetCadence === 'monthly' ? 'monthly budget' : 'daily allowance'}`}
        </Text>
      </View>

      {/* Unboxed Minimal Stat Row */}
      <View style={[styles.heroStatsRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 10 }]}>
        {/* Best Streak */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <GradientIconBadge size={28} color="#FFFFFF" isDark={isDark}>
            {({ iconColor }) => <Trophy size={14} color={iconColor} />}
          </GradientIconBadge>
          <View style={styles.heroStatTextWrap}>
            <Text style={[styles.heroStatLabel, { color: 'rgba(255, 255, 255, 0.7)' }]}>
              Best Streak
            </Text>
            <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>
              {effectiveBestStreak} {budgetCadence === 'weekly' ? (effectiveBestStreak === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (effectiveBestStreak === 1 ? 'Month' : 'Months') : (effectiveBestStreak === 1 ? 'Day' : 'Days')}
            </Text>
          </View>
        </View>

        {/* Vertical Divider */}
        <View style={{ width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center' }} />

        {/* Saved Days */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <GradientIconBadge size={28} color="#FFFFFF" isDark={isDark}>
            {({ iconColor }) => <Sparkles size={14} color={iconColor} />}
          </GradientIconBadge>
          <View style={styles.heroStatTextWrap}>
            <Text style={[styles.heroStatLabel, { color: 'rgba(255, 255, 255, 0.7)' }]}>
              {budgetCadence === 'weekly' ? 'Saved Weeks' : budgetCadence === 'monthly' ? 'Saved Months' : 'Saved Days'}
            </Text>
            <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>
              {savedDaysCount} {budgetCadence === 'weekly' ? (savedDaysCount === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (savedDaysCount === 1 ? 'Month' : 'Months') : (savedDaysCount === 1 ? 'Day' : 'Days')}
            </Text>
          </View>
        </View>
      </View>

      {/* Action: Deposit into Gullak */}
      <TouchableOpacity
        style={[
          styles.depositCtaBtn,
          {
            backgroundColor: '#FFFFFF',
            borderColor: '#FFFFFF',
            marginTop: 12,
          },
        ]}
        onPress={onOpenDepositModal}
        activeOpacity={0.75}
      >
        <Plus size={17} color="#5B21B6" />
        <Text style={[styles.depositCtaBtnText, { color: '#5B21B6' }]}>
          Deposit to Gullak
        </Text>
      </TouchableOpacity>
    </View>
  );
};
