import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The user's on / off choice for the ambient background (Profile -> Ambient Background). On by default.
 *
 * `hydrated` stays false until the saved choice has been read, so someone who switched it off never sees a flash of the
 * effect while the app starts.
 */
interface AmbientState {
  enabled: boolean;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useAmbientStore = create<AmbientState>()(
  persist(
    (set) => ({
      enabled: true,
      hydrated: false,
      setEnabled: (enabled: boolean) => set({ enabled }),
    }),
    {
      name: 'arthik-ambient-preference',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ enabled: state.enabled }),
      onRehydrateStorage: () => () => {
        // deferred one tick: the store variable is not assigned yet if storage answered synchronously
        setTimeout(() => useAmbientStore.setState({ hydrated: true }), 0);
      },
    }
  )
);
