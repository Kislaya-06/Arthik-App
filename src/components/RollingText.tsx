import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  PixelRatio,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  useAnimatedValue,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  DigitRoll,
  ROLL_DURATION_MS,
  ROLL_STAGGER_MS,
  RollPlan,
  planRoll,
  splitRollingStyles,
  wheelEnd,
  wheelStart,
} from '../lib/rollingText';
import { getAdvanceEm, getMaxDigitEm, measureTextWidth } from '../lib/quicksandMetrics';

function useSafeIsFocused(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

/**
 * Text whose DIGITS roll like an odometer / slot reel whenever the number changes.
 *
 * Reproduces the reference animation:
 *  - every digit of the changed number spins through 0-9 together and eases out onto its new value
 *  - a number that goes down rolls downward (new digits enter from the top); up rolls upward
 *  - symbols (₹ + − ,) and words never move; digits fade towards the top/bottom edge of the line
 *  - the whole thing runs on the native thread (no JS work per frame, no re-rendering)
 *
 * When nothing is changing it renders ONE plain <Text> (exactly like a normal label), so there is no cost
 * and no visual difference at rest.
 *
 * The animation is skipped on first render, when the sentence around the numbers changes (it is simply
 * swapped), and when the OS "remove animations" accessibility setting is on.
 *
 * Fit-to-width: pass `fitWidth` (dp available for the text) and `minScale` to shrink long values like
 * adjustsFontSizeToFit did. If `fitWidth` is omitted but `minScale` is set, the component measures its own
 * container, which then MUST have a width that does not depend on its content (flex: 1 / stretch).
 *
 * Only Quicksand is supported (widths come from lib/quicksandMetrics.ts).
 */

export interface RollingTextProps {
  text: string;
  /** Needs fontFamily + fontSize + color. lineHeight optional. */
  style: TextStyle;
  /** Smallest fit-to-width scale (e.g. 0.6). Omit to disable fitting. */
  minScale?: number;
  /** dp available for the text; if omitted, the container's own width is used. */
  fitWidth?: number;
  containerStyle?: StyleProp<ViewStyle>;
  /** Set false to disable the roll for this instance. */
  animate?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** true = rolls up from zero whenever the screen gains focus. */
  rollOnFocus?: boolean;
}

// ─── OS "reduce motion" (shared by every instance) ───────────────────────────

let reduceMotionValue = false;
let reduceMotionInit = false;
const reduceMotionListeners = new Set<(v: boolean) => void>();

function initReduceMotion() {
  if (reduceMotionInit) return;
  reduceMotionInit = true;
  try {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotionValue = v;
        reduceMotionListeners.forEach((l) => l(v));
      })
      .catch(() => {});
    AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionValue = v;
      reduceMotionListeners.forEach((l) => l(v));
    });
  } catch {
    // best effort
  }
}

function useReduceMotion(): boolean {
  const [value, setValue] = useState(reduceMotionValue);
  useEffect(() => {
    initReduceMotion();
    reduceMotionListeners.add(setValue);
    setValue(reduceMotionValue);
    return () => {
      reduceMotionListeners.delete(setValue);
    };
  }, []);
  return value;
}

// ─── One spinning digit ──────────────────────────────────────────────────────

const GLYPHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; // 11th glyph = a second "0" so the strip wraps seamlessly

interface DigitWheelProps {
  roll: DigitRoll;
  fontSize: number;
  lineHeight: number;
  family?: string;
  textStyle: TextStyle;
  delay: number;
}

const DigitWheel: React.FC<DigitWheelProps> = ({ roll, fontSize, lineHeight, family, textStyle, delay }) => {
  // The ONLY thing that animates is this value, and it runs entirely on the native thread. Layout (the cell
  // width) is NOT animated: it is the final width from the first frame. Animating width from the JS thread made
  // the number lag behind the spin whenever JS was busy and then snap into place when the roll ended (jitter).
  const position = useAnimatedValue(wheelStart(roll));

  const cellWidth = getAdvanceEm(family, String(roll.to)) * fontSize; // identical to the resting digit's width
  const boxWidth = getMaxDigitEm(family) * fontSize; // wide enough that no digit is clipped sideways

  useEffect(() => {
    const move = Animated.timing(position, {
      toValue: wheelEnd(roll),
      duration: ROLL_DURATION_MS,
      delay,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    });
    move.start();
    return () => {
      move.stop();
    };
    // One roll per mount: the parent re-mounts the wheel (new key) for every new roll.
  }, []);

  const wheel = useMemo(() => Animated.modulo(position, 10), [position]);
  const translateY = useMemo(() => Animated.multiply(wheel, -lineHeight), [wheel, lineHeight]);
  const opacities = useMemo(
    () =>
      GLYPHS.map((_, k) =>
        wheel.interpolate({
          inputRange: [k - 1, k - 0.25, k, k + 0.25, k + 1],
          outputRange: [0, 1, 1, 1, 0],
          extrapolate: 'clamp',
        })
      ),
    [wheel]
  );

  return (
    <View style={{ width: cellWidth, height: lineHeight }}>
      <View style={[styles.clipBox, { width: boxWidth, height: lineHeight, left: (cellWidth - boxWidth) / 2 }]}>
        <Animated.View style={{ width: boxWidth, transform: [{ translateY }] }}>
          {GLYPHS.map((d, k) => (
            <Animated.Text
              key={k}
              allowFontScaling={false}
              style={[
                textStyle,
                styles.glyphText,
                {
                  width: boxWidth,
                  height: lineHeight,
                  lineHeight,
                  fontSize,
                  textAlign: 'center',
                  opacity: opacities[k],
                },
              ]}
            >
              {d}
            </Animated.Text>
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

// ─── One resting digit ───────────────────────────────────────────────────────

/**
 * A digit at rest. It uses EXACTLY the same geometry as a DigitWheel does when its roll ends (same cell
 * width, same centred glyph box, same line box), so when a roll finishes and the wheel is swapped for this,
 * nothing moves by even a pixel. (Swapping to one plain <Text> used to nudge the number: native text layout
 * rounds and kerns differently from a row of cells.)
 */
interface StaticDigitProps {
  digit: string;
  fontSize: number;
  lineHeight: number;
  family?: string;
  textStyle: TextStyle;
}

const StaticDigit: React.FC<StaticDigitProps> = ({ digit, fontSize, lineHeight, family, textStyle }) => {
  const cellWidth = getAdvanceEm(family, digit) * fontSize;
  const boxWidth = getMaxDigitEm(family) * fontSize;
  return (
    <View style={{ width: cellWidth, height: lineHeight }}>
      <View style={[styles.clipBox, { width: boxWidth, height: lineHeight, left: (cellWidth - boxWidth) / 2 }]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[
            textStyle,
            styles.glyphText,
            { width: boxWidth, height: lineHeight, lineHeight, fontSize, textAlign: 'center' },
          ]}
        >
          {digit}
        </Text>
      </View>
    </View>
  );
};

// ─── The text ────────────────────────────────────────────────────────────────

interface ActiveRoll {
  id: number;
  text: string;
  plan: RollPlan;
}

export const RollingText: React.FC<RollingTextProps> = ({
  text,
  style,
  minScale,
  fitWidth,
  containerStyle,
  animate = true,
  testID,
  accessibilityLabel,
  rollOnFocus,
}) => {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const family = flat.fontFamily;
  const baseSize = flat.fontSize ?? 14;
  const fontScale = PixelRatio.getFontScale();

  const [measuredWidth, setMeasuredWidth] = useState(0);
  const available = fitWidth ?? measuredWidth;

  // Fit to width (replaces adjustsFontSizeToFit): scale from the exact Quicksand glyph widths.
  const scale = useMemo(() => {
    if (!minScale || !(available > 0)) return 1;
    const natural = measureTextWidth(text, family, baseSize * fontScale);
    if (!(natural > 0)) return 1;
    if (natural <= available * 1.02) return 1;
    return Math.max(minScale, Math.min(1, (available * 0.985) / natural));
  }, [minScale, available, text, family, baseSize, fontScale]);

  const fontSize = baseSize * scale * fontScale;
  const lineHeight = Math.round((flat.lineHeight ? flat.lineHeight : baseSize * 1.28) * scale * fontScale);

  const { containerStyle: layoutStyle, textStyle: pureTextStyle } = useMemo(
    () => splitRollingStyles(flat),
    [flat]
  );

  const textStyle: TextStyle = useMemo(
    () => ({
      ...pureTextStyle,
      fontSize,
      lineHeight,
      includeFontPadding: false,
    }),
    [pureTextStyle, fontSize, lineHeight]
  );

  // ── Detect a change and start a roll (layout effect: no frame of the new text before the wheels) ──
  const [active, setActive] = useState<ActiveRoll | null>(null);
  const lastTextRef = useRef(text);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReduceMotion();
  const isFocused = useSafeIsFocused();
  const wasFocusedRef = useRef(false);

  // A tab hidden by freezeOnBlur may never commit a "blurred" render, so wasFocusedRef could stay `true` and the
  // return to the screen would not roll. React re-runs layout effects when a frozen tab is revealed (even with no
  // dependency change), so this effect (declared BEFORE the one below, so it runs first) forgets the previous focus on
  // mount and on every reveal.
  useLayoutEffect(() => {
    wasFocusedRef.current = false;
  }, []);

  useLayoutEffect(() => {
    const prev = lastTextRef.current;
    const justGainedFocus = !!rollOnFocus && isFocused && !wasFocusedRef.current;
    wasFocusedRef.current = isFocused;

    // If screen is in the background, keep last text in sync and avoid background animation
    if (!isFocused) {
      lastTextRef.current = text;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActive(null);
      return;
    }

    if (!animate || reduceMotion) {
      lastTextRef.current = text;
      setActive(null);
      return;
    }

    // Determine what roll to plan:
    // 1. Entering the screen (even if the value also changed while away): roll up from 0 to the value
    // 2. Normal value change while the screen is visible: roll between prev and text
    let plan: RollPlan | null = null;
    if (justGainedFocus) {
      lastTextRef.current = text;
      const zeroText = text.replace(/\d[\d,]*(?:\.\d+)?/g, '0');
      if (zeroText !== text) {
        plan = planRoll(zeroText, text);
      }
    } else if (prev !== text) {
      lastTextRef.current = text;
      plan = planRoll(prev, text);
    } else {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!plan) {
      setActive(null);
      return;
    }

    const id = ++idRef.current;
    setActive({ id, text, plan });
    const rollCount = Object.keys(plan.rolls).length;
    timerRef.current = setTimeout(
      () => setActive((cur) => (cur && cur.id === id ? null : cur)),
      ROLL_DURATION_MS + ROLL_STAGGER_MS * rollCount + 80
    );
  }, [text, animate, reduceMotion, isFocused, rollOnFocus]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    if (fitWidth !== undefined) return;
    const w = Math.round(e.nativeEvent.layout.width);
    setMeasuredWidth((prev) => (prev === w ? prev : w));
  };

  // ── Always the same structure: text runs + one cell per digit. Rolling digits are wheels, the rest are
  //    resting digits with identical geometry, so the end of a roll is visually seamless. ──
  const rolls = active && active.text === text ? active.plan.rolls : null;
  const cells: React.ReactNode[] = [];
  let run = '';
  let runStart = 0;
  let order = 0;
  const flush = () => {
    if (run.length > 0) {
      cells.push(
        <Text
          key={`t${runStart}`}
          allowFontScaling={false}
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[textStyle, styles.glyphText, { height: lineHeight }]}
        >
          {run}
        </Text>
      );
      run = '';
    }
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch >= '0' && ch <= '9') {
      flush();
      const roll = rolls ? rolls[i] : undefined;
      cells.push(
        roll ? (
          <DigitWheel
            key={`w${active!.id}-${i}`}
            roll={roll}
            fontSize={fontSize}
            lineHeight={lineHeight}
            family={family}
            textStyle={textStyle}
            delay={ROLL_STAGGER_MS * order++}
          />
        ) : (
          <StaticDigit
            key={`d${i}`}
            digit={ch}
            fontSize={fontSize}
            lineHeight={lineHeight}
            family={family}
            textStyle={textStyle}
          />
        )
      );
    } else {
      if (run.length === 0) runStart = i;
      run += ch;
    }
  }
  flush();

  // Clip only when the text is genuinely wider than its slot (even at minScale); otherwise let wheel glyphs overhang freely.
  const needsClip = !!minScale && fitWidth !== undefined && available > 0 && measureTextWidth(text, family, fontSize) > available * 1.01;

  const content = (
    <View style={[styles.row, { height: lineHeight }, needsClip ? { maxWidth: available, overflow: 'hidden' } : null]}>
      {cells}
    </View>
  );

  return (
    <View
      style={[layoutStyle, containerStyle]}
      onLayout={onContainerLayout}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      testID={testID}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {content}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  clipBox: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  glyphText: {
    margin: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});

export default RollingText;
