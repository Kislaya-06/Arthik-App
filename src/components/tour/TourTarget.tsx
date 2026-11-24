/**
 * Marks a feature the "What's new" tour can spotlight. Wrap the element; pass the screen's ScrollView ref when the
 * element may be below the fold, so the tour scrolls it into view first.
 */
import React, { useEffect, useRef } from 'react';
import { ScrollView, View, ViewStyle, StyleProp } from 'react-native';
import { useTourStore, TourRect } from '../../store/tourStore';

interface Props {
  id: string;
  scrollRef?: React.RefObject<ScrollView | null>;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inWindow = (v: View | null) =>
  new Promise<TourRect | null>((resolve) => {
    if (!v) return resolve(null);
    v.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });

export const TourTarget: React.FC<Props> = ({ id, scrollRef, style, children }) => {
  const ref = useRef<View>(null);
  const register = useTourStore((s) => s.register);

  useEffect(
    () =>
      register(id, async () => {
        const scroll = scrollRef?.current;
        // getInnerViewRef exists at runtime but is missing from RN's types; measureLayout needs a host ref, not a node number.
        const inner = (scroll as unknown as { getInnerViewRef?: () => View | null } | null)?.getInnerViewRef?.();
        if (scroll && inner && ref.current) {
          const scrolled = new Promise<void>((resolve) => {
            ref.current!.measureLayout(
              inner,
              (_x, y) => {
                scroll.scrollTo({ y: Math.max(0, y - 160), animated: true });
                resolve();
              },
              () => resolve()
            );
          });
          await Promise.race([scrolled, wait(600)]); // never let the tour hang on a measure that does not answer
          await wait(420); // let the scroll settle before measuring
        }
        return inWindow(ref.current);
      }),
    [id, scrollRef, register]
  );

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
};
