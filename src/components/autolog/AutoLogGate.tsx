import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { navigateTo } from '../../navigation/navigationRef';
import * as service from '../../features/autoLog/service';
import { useAutoLogStore } from '../../features/autoLog/store';
import { supabase } from '../../config/supabase';
import {
  fetchRollout, getInstallCohort, isAutoLogAvailable, isExistingUser, isIntroSeen, shouldShowIntro,
} from '../../features/autoLog/rollout';

/**
 * Invisible. Mounted with the main tabs. Decides what Automatic Logging needs on entry:
 *  - signed back in      → "Welcome back" (Recover / Learn)        spec §27
 *  - local state missing → "Setup no longer available" (re-setup)  spec §30–31
 *  - live                → drain the queue, catch up, refresh       spec §49
 * Clear cache keeps the encrypted DB, so it never triggers a popup (spec §36).
 */
export const AutoLogGate = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const evaluatedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !service.isSupported()) return;
    let cancelled = false;

    const tick = async () => {
      try {
        if (evaluatedFor.current !== userId) {
          evaluatedFor.current = userId;
          const { decision, remoteEnabled } = await service.evaluateEntry(userId);
          if (cancelled) return;
          useAutoLogStore.getState().setRemoteEnabled(remoteEnabled);

          // Beta rollout: who may see the feature + one-time intro for existing users only.
          const [rollout, cohort, local] = await Promise.all([
            fetchRollout(supabase),
            getInstallCohort(),
            service.readLocalState(userId),
          ]);
          if (cancelled) return;
          const existingUser = isExistingUser({ cohort, accountCreatedAt: useAuthStore.getState().user?.created_at, rollout });
          const alreadyUsing = local.setupComplete || remoteEnabled;
          const available = isAutoLogAvailable({ rollout, existingUser, alreadyUsing });
          useAutoLogStore.getState().setAvailable(available);
          const showIntro =
            decision.kind === 'none' &&
            shouldShowIntro({ available, existingUser, alreadyUsing, introSeen: await isIntroSeen(userId) });

          if (showIntro) {
            navigateTo('AutoLogIntro');
          } else if (decision.kind === 'welcome_back') {
            navigateTo('AutoLogWelcomeBack', { from: decision.from, to: decision.to, reason: 'signout' });
          } else if (decision.kind === 'data_loss') {
            navigateTo('AutoLogSetup', { mode: 'resetup', lastActiveAt: decision.lastActiveAt, previous: decision.previous });
          }
        }
        const live = await service.processQueue(userId, { notify: false });
        if (live) await service.ensureBackgroundRegistered();
      } catch {
        // Never block the app because of Automatic Logging.
      } finally {
        if (!cancelled) useAutoLogStore.getState().refresh(userId);
      }
    };

    // Let the Home screen render first.
    const t = setTimeout(tick, 800);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      cancelled = true;
      clearTimeout(t);
      sub.remove();
    };
  }, [userId]);

  return null;
};
