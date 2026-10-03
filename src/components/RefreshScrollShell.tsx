import React, { createContext, useContext, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { AppRefreshControl } from './AppRefreshControl';

/**
 * Gives a screen that is NOT a ScrollView (Home) the same native pull-to-refresh as the screens that are.
 *
 * It is a ScrollView whose content is exactly one screen tall, so it never scrolls by itself; it only
 * hosts the native refresh circle. The circle drops from the top of the screen like on History, Savings
 * and Insights, and no content moves.
 *
 * Home's list handles its own touches, so it tells the shell when it must not be pulled-to-refresh
 * (list scrolled away from the top, or a finger is dragging it) via `useRefreshLock`.
 */

const RefreshLockContext = createContext<(locked: boolean) => void>(() => {});

/** Call with `true` to switch the pull-to-refresh off, `false` to switch it back on. */
export const useRefreshLock = () => useContext(RefreshLockContext);

export interface RefreshScrollShellProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

export const RefreshScrollShell: React.FC<RefreshScrollShellProps> = ({ refreshing, onRefresh, children }) => {
  const [locked, setLocked] = useState(false);

  return (
    <RefreshLockContext.Provider value={setLocked}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        // Content == viewport, so there is nothing to scroll. Disabling scroll on Android also stops this
        // ScrollView from ever stealing Home's upward pull; the native refresh circle still works.
        scrollEnabled={Platform.OS === 'ios'}
        alwaysBounceVertical
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} enabled={!locked} />}
      >
        {children}
      </ScrollView>
    </RefreshLockContext.Provider>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
});

export default RefreshScrollShell;
