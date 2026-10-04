import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  useAnimatedValue,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Coins,
  Wallet,
  Sparkles,
  Clock,
  Lock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import {
  MoneyExplainerTopic,
  getMoneyExplainerContent,
} from '../lib/moneyExplainerContent';

let badgeGradCounter = 0;

// ─── 1. Tactile Gradient Exclamation Circle Badge ────────────────────────────
export interface MoneyHelpBadgeProps {
  onPress: () => void;
  size?: number;
  highlight?: boolean;
  style?: object;
  testID?: string;
}

export const MoneyHelpBadge: React.FC<MoneyHelpBadgeProps> = ({
  onPress,
  size = 20,
  highlight = false,
  style,
  testID,
}) => {
  const { colors, isDark } = useTheme();
  const scaleAnim = useAnimatedValue(1);
  const radius = size / 2;

  const gradId = useMemo(() => {
    badgeGradCounter = (badgeGradCounter + 1) % 1000000;
    return `mhelp_grad_${badgeGradCounter}`;
  }, []);

  useEffect(() => {
    if (highlight) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.25,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [highlight, scaleAnim]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={testID || 'money-help-badge'}
        style={[
          styles.badgeCircle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            shadowColor: colors.moneyBadgeGradEnd,
            shadowOpacity: isDark ? 0.35 : 0.25,
            shadowRadius: 4,
            elevation: 2,
          },
        ]}
      >
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradId} x1="12%" y1="0%" x2="88%" y2="100%">
              <Stop offset="0%" stopColor={colors.moneyBadgeGradStart} />
              <Stop offset="50%" stopColor={colors.moneyBadgeGradMid} />
              <Stop offset="100%" stopColor={colors.moneyBadgeGradEnd} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={radius}
            cy={radius}
            r={radius - 0.5}
            fill={`url(#${gradId})`}
            stroke={colors.moneyBadgeBorder}
            strokeWidth={1}
          />
        </Svg>
        <Text
          style={[
            styles.exclamationText,
            {
              color: colors.moneyBadgeText,
              fontSize: Math.max(11, Math.round(size * 0.65)),
              fontFamily: FontFamily.bold,
            },
          ]}
        >
          !
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── 2. Icon Dictionary ───────────────────────────────────────────────────────
const ICON_MAP = {
  shield: ShieldCheck,
  calendar: Calendar,
  coins: Coins,
  wallet: Wallet,
  sparkles: Sparkles,
  clock: Clock,
  lock: Lock,
  check: CheckCircle2,
};

// ─── 3. Full Explainer Modal ──────────────────────────────────────────────────
export interface MoneyExplainerModalProps {
  visible: boolean;
  topic: MoneyExplainerTopic;
  onClose: () => void;
}

export const MoneyExplainerModal: React.FC<MoneyExplainerModalProps> = ({
  visible,
  topic,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const content = getMoneyExplainerContent(topic);

  const anim = useAnimatedValue(0);

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, anim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Full-screen backdrop tap target */}
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.48)' },
          ]}
          onPress={onClose}
        />

        {/* Modal Card */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(Spacing.surface, insets.bottom + Spacing.element),
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.93, 1],
                  }),
                },
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <MoneyHelpBadge size={26} onPress={() => {}} style={{ marginRight: Spacing.element }} />
              <Text
                style={[
                  styles.headerTitle,
                  { color: colors.textPrimary, fontFamily: FontFamily.bold },
                ]}
                numberOfLines={1}
              >
                {content.title}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle }]}
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text
            style={[
              styles.subtitle,
              { color: colors.textSecondary, fontFamily: FontFamily.medium },
            ]}
          >
            {content.subtitle}
          </Text>

          {/* Smooth, Unblocked Scrollable List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {content.items.map((item, index) => {
              const IconComp = ICON_MAP[item.iconName] || CheckCircle2;
              const accentColor = isDark ? '#93C5FD' : '#2563EB';
              const iconBg = isDark ? 'rgba(59, 130, 246, 0.14)' : 'rgba(37, 99, 235, 0.08)';

              return (
                <View
                  key={index}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <View style={[styles.itemIconWrap, { backgroundColor: iconBg }]}>
                    <IconComp size={18} color={accentColor} strokeWidth={2.2} />
                  </View>

                  <View style={styles.itemTextWrap}>
                    <View style={styles.itemTagRow}>
                      <Text
                        style={[
                          styles.itemTag,
                          {
                            color: isDark ? colors.mintGreen : colors.forestGreen,
                            fontFamily: FontFamily.bold,
                          },
                        ]}
                      >
                        {item.tag}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: colors.textPrimary, fontFamily: FontFamily.bold },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.itemDescription,
                        { color: colors.textSecondary, fontFamily: FontFamily.medium },
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Footer Tip Callout */}
            {content.footerTip ? (
              <View
                style={[
                  styles.footerTipCard,
                  {
                    backgroundColor: isDark ? 'rgba(184, 224, 200, 0.08)' : '#F0FAF4',
                    borderColor: isDark ? 'rgba(184, 224, 200, 0.25)' : '#C6ECD3',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.footerTipText,
                    {
                      color: isDark ? colors.mintGreen : colors.forestGreen,
                      fontFamily: FontFamily.medium,
                    },
                  ]}
                >
                  {content.footerTip}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky "Got It" CTA */}
          <TouchableOpacity
            style={[
              styles.gotItButton,
              { backgroundColor: colors.mintGreen },
            ]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.gotItText,
                { color: colors.forestGreen, fontFamily: FontFamily.bold },
              ]}
            >
              Got It
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  badgeCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  exclamationText: {
    lineHeight: 14,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    borderRadius: BorderRadius.cardLarge,
    borderWidth: 1,
    paddingHorizontal: Spacing.surface,
    paddingTop: Spacing.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.micro,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.element,
  },
  headerTitle: {
    fontSize: FontSize.cta,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: 19,
    marginBottom: Spacing.element,
  },
  scrollList: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.element,
    paddingTop: Spacing.micro,
  },
  itemCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.group,
    alignItems: 'flex-start',
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.group,
    marginTop: 2,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTagRow: {
    marginBottom: Spacing.nano,
  },
  itemTag: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemTitle: {
    fontSize: FontSize.bodySmall + 1,
    marginBottom: Spacing.micro,
  },
  itemDescription: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  footerTipCard: {
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.group,
  },
  footerTipText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  gotItButton: {
    height: 48,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.element,
  },
  gotItText: {
    fontSize: FontSize.body,
  },
});
